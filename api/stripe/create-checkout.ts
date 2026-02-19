/**
 * POST /api/stripe/create-checkout
 * 
 * Crea una sesión de Stripe Checkout para el plan seleccionado.
 * Al completar el pago, Stripe redirige a success_url con session_id.
 * El webhook procesa la confirmación y activa el plan.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripeClient, getStripePriceIds } from '../../server/lib/stripe.js';
import { createClient } from '@supabase/supabase-js';
import type { StripePlanKey } from '../../server/lib/stripe.js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin',
        req.headers.origin?.includes('localhost') ? req.headers.origin : 'https://method.fertyfit.com'
    );
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const stripe = getStripeClient();
        const STRIPE_PRICE_IDS = getStripePriceIds();

        const { planId, userId, userEmail } = req.body as {
            planId: StripePlanKey;
            userId: string;
            userEmail: string;
        };

        if (!planId || !userId || !userEmail) {
            return res.status(400).json({ error: 'Faltan parámetros: planId, userId, userEmail' });
        }

        const priceId = STRIPE_PRICE_IDS[planId];
        if (!priceId) {
            return res.status(400).json({
                error: `Plan "${planId}" no configurado. Añade el Price ID en las variables de entorno.`
            });
        }

        // Determinar si es pago único o suscripción mensual
        const isMonthly = planId.endsWith('_monthly');


        // Obtener o crear el stripe_customer_id del usuario
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        let customerId = profile?.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: { userId },
            });
            customerId = customer.id;

            // Guardar el customer ID en profiles
            await supabase
                .from('profiles')
                .update({ stripe_customer_id: customerId })
                .eq('id', userId);
        }

        const appUrl = process.env.VITE_APP_URL || 'https://method.fertyfit.com';

        // Crear la sesión de Stripe Checkout
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                    // Si es mensual, Stripe repetirá el cobro automáticamente
                    // Si es pago único, se cobra una sola vez (price debe ser de tipo 'one_time')
                },
            ],
            mode: isMonthly ? 'subscription' : 'payment',
            success_url: `${appUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}?checkout=canceled`,
            metadata: {
                userId,
                planId,
                paymentMode: isMonthly ? 'monthly' : 'full',
            },
            // Permitir códigos promocionales
            allow_promotion_codes: true,
        });

        return res.status(200).json({
            checkoutUrl: session.url,
            sessionId: session.id,
        });

    } catch (error: any) {
        console.error('[STRIPE_CHECKOUT] Error:', error?.message || error);
        return res.status(500).json({ error: error?.message || 'Error creando sesión de pago' });
    }
}
