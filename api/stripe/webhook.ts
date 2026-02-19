/**
 * POST /api/stripe/webhook
 * 
 * Recibe y procesa eventos de Stripe.
 * Verifica la firma del webhook y actualiza el user_type en profiles.
 * 
 * Eventos procesados:
 * - checkout.session.completed → activa el plan (premium/vip)
 * - customer.subscription.deleted → desactiva el plan (→ free)
 * - invoice.payment_failed → marca como past_due
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { stripe } from '../../server/lib/stripe.js';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// Mapeo de planId a user_type
const PLAN_TO_TIER: Record<string, 'premium' | 'vip'> = {
    premium_monthly: 'premium',
    premium_full: 'premium',
    vip_monthly: 'vip',
    vip_full: 'vip',
};

export const config = {
    api: {
        bodyParser: false, // CRÍTICO: Stripe necesita el body raw para verificar la firma
    },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET no configurado');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;
    try {
        const rawBody = await getRawBody(req);
        const signature = req.headers['stripe-signature'] as string;
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
        console.error('[WEBHOOK] Firma inválida:', err.message);
        return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
    }

    console.log(`[WEBHOOK] Evento: ${event.type} | ID: ${event.id}`);

    // Idempotencia: verificar si ya procesamos este evento
    const { data: existing } = await supabase
        .from('subscription_events')
        .select('id')
        .eq('stripe_event_id', event.id)
        .single();

    if (existing) {
        console.log(`[WEBHOOK] Evento ${event.id} ya procesado, ignorando.`);
        return res.status(200).json({ received: true, skipped: true });
    }

    // Registrar el evento (antes de procesar, para idempotencia)
    await supabase.from('subscription_events').insert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event as any,
    });

    try {
        switch (event.type) {

            // ✅ PAGO COMPLETADO → Activar plan
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                const planId = session.metadata?.planId;
                const paymentMode = session.metadata?.paymentMode as 'monthly' | 'full';

                if (!userId || !planId) {
                    console.error('[WEBHOOK] Metadata incompleta en checkout.session:', session.id);
                    break;
                }

                const tier = PLAN_TO_TIER[planId];
                if (!tier) {
                    console.error('[WEBHOOK] planId desconocido:', planId);
                    break;
                }

                // Calcular fecha de fin para pagos completos (3 meses)
                const now = new Date();
                const subscriptionEnd = paymentMode === 'full'
                    ? new Date(now.setMonth(now.getMonth() + 3)).toISOString()
                    : null; // Para mensual, Stripe gestiona la renovación

                const { error } = await supabase
                    .from('profiles')
                    .update({
                        user_type: tier,
                        method_start_date: new Date().toISOString(),
                        stripe_subscription_id: session.subscription as string || null,
                        subscription_status: 'active',
                        payment_mode: paymentMode,
                        subscription_start: new Date().toISOString(),
                        subscription_end: subscriptionEnd,
                    })
                    .eq('id', userId);

                if (error) {
                    console.error('[WEBHOOK] Error actualizando profile:', error);
                } else {
                    console.log(`[WEBHOOK] ✅ Plan ${tier} activado para user ${userId}`);
                }

                // Actualizar user_id en el evento de Stripe
                await supabase
                    .from('subscription_events')
                    .update({ user_id: userId })
                    .eq('stripe_event_id', event.id);

                break;
            }

            // ❌ SUSCRIPCIÓN CANCELADA → Volver a free
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (profileData) {
                    await supabase
                        .from('profiles')
                        .update({
                            user_type: 'free',
                            subscription_status: 'canceled',
                            stripe_subscription_id: null,
                            subscription_end: new Date().toISOString(),
                        })
                        .eq('id', profileData.id);

                    console.log(`[WEBHOOK] ⚠️ Suscripción cancelada para customer ${customerId} → free`);
                }
                break;
            }

            // ⚠️ PAGO FALLIDO → Marcar como past_due
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (profileData) {
                    await supabase
                        .from('profiles')
                        .update({ subscription_status: 'past_due' })
                        .eq('id', profileData.id);

                    console.log(`[WEBHOOK] ⚠️ Pago fallido para customer ${customerId}`);
                }
                break;
            }

            default:
                console.log(`[WEBHOOK] Evento no procesado: ${event.type}`);
        }
    } catch (processingError: any) {
        console.error('[WEBHOOK] Error procesando evento:', processingError?.message);
        // No devolvemos error 500 para que Stripe no reintente - ya lo registramos
    }

    return res.status(200).json({ received: true });
}
