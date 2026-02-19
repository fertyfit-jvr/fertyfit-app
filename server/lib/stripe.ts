/**
 * Stripe Client — FertyFit
 * Inicialización del cliente de Stripe para uso en el servidor (API routes)
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY no está configurada en las variables de entorno');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-01-28.clover',
});

/**
 * IDs de los productos/precios en Stripe.
 * IMPORTANTE: Estos IDs se generan cuando creas los productos en el dashboard de Stripe.
 * Rellena los campos vacíos con los Price IDs reales de tu cuenta Stripe Live.
 * 
 * Cómo obtenerlos: Dashboard Stripe → Products → [Product] → [Price] → copiar "Price ID" (price_xxx)
 */
export const STRIPE_PRICE_IDS = {
    premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || '',  // ej: price_xxx
    premium_full: process.env.STRIPE_PRICE_PREMIUM_FULL || '',  // ej: price_xxx
    vip_monthly: process.env.STRIPE_PRICE_VIP_MONTHLY || '',  // ej: price_xxx
    vip_full: process.env.STRIPE_PRICE_VIP_FULL || '',  // ej: price_xxx
} as const;

export type StripePlanKey = keyof typeof STRIPE_PRICE_IDS;
