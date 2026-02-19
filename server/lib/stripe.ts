/**
 * Stripe Client — FertyFit
 * Inicialización lazy del cliente de Stripe para uso en API routes.
 * No lanza errores a nivel de módulo para evitar FUNCTION_INVOCATION_FAILED.
 */

import Stripe from 'stripe';

/**
 * Devuelve el cliente de Stripe inicializado.
 * Usa lazy init para que el error sea capturado por el handler, no al importar.
 */
export function getStripeClient(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error('[Stripe] STRIPE_SECRET_KEY no configurada en variables de entorno');
    }
    return new Stripe(key, {
        apiVersion: '2026-01-28.clover',
    });
}

/**
 * IDs de Price en Stripe (se configuran como env vars en Vercel).
 * Valores reales añadidos en las variables de entorno del proyecto.
 */
export function getStripePriceIds() {
    return {
        premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || '',
        premium_full: process.env.STRIPE_PRICE_PREMIUM_FULL || '',
        vip_monthly: process.env.STRIPE_PRICE_VIP_MONTHLY || '',
        vip_full: process.env.STRIPE_PRICE_VIP_FULL || '',
    } as const;
}

export type StripePlanKey = 'premium_monthly' | 'premium_full' | 'vip_monthly' | 'vip_full';
