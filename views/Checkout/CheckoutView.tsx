/**
 * CheckoutView — FertyFit
 * Pantalla de selección de plan (Premium / VIP) con toggle mensual / completo.
 * Al hacer clic en "Contratar" llama al endpoint /api/stripe/create-checkout
 * y redirige al checkout de Stripe.
 */

import React, { useState } from 'react';
import { Crown, Star, Check, ArrowLeft, Loader2, Lock } from 'lucide-react';
import type { UserProfile, ViewState, PlanId } from '../../types';

interface CheckoutViewProps {
    user: UserProfile;
    onNavigate: (view: ViewState) => void;
    showNotif: (msg: string, type: 'success' | 'error') => void;
}

type PaymentMode = 'monthly' | 'full';

const PLANS = [
    {
        id: 'premium' as const,
        name: 'Premium',
        icon: Star,
        color: 'ferty-rose',
        colorClass: 'from-ferty-rose to-ferty-coral',
        monthlyPrice: 49,
        fullPrice: 129,
        fullPlanId: 'premium_full' as PlanId,
        monthlyPlanId: 'premium_monthly' as PlanId,
        features: [
            'Todos los informes (BASIC, DAILY, 360, LABS)',
            'Todos los módulos educativos (Fases 1-3)',
            'Registros diarios ilimitados',
            'Seguimiento personalizado completo',
        ],
        notIncluded: [
            'Revisión por especialista',
            'Consulta online con Dra. Liliana Vázquez',
        ],
    },
    {
        id: 'vip' as const,
        name: 'VIP',
        icon: Crown,
        color: 'amber',
        colorClass: 'from-amber-500 to-amber-600',
        monthlyPrice: 99,
        fullPrice: 249,
        fullPlanId: 'vip_full' as PlanId,
        monthlyPlanId: 'vip_monthly' as PlanId,
        features: [
            'Todo lo de Premium',
            'Informes revisados por especialista ✅',
            'Consulta online con Dra. Liliana Vázquez',
            'Atención prioritaria',
        ],
        notIncluded: [],
    },
];

const CheckoutView = ({ user, onNavigate, showNotif }: CheckoutViewProps) => {
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('monthly');
    const [loading, setLoading] = useState<string | null>(null); // planId being processed

    const handleCheckout = async (plan: typeof PLANS[number]) => {
        if (!user.id || !user.email) {
            showNotif('Error: sesión no válida. Por favor, vuelve a iniciar sesión.', 'error');
            return;
        }

        const planId: PlanId = paymentMode === 'monthly' ? plan.monthlyPlanId : plan.fullPlanId;
        setLoading(planId);

        try {
            const response = await fetch('/api/stripe/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId,
                    userId: user.id,
                    userEmail: user.email,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.checkoutUrl) {
                throw new Error(data.error || 'Error al crear la sesión de pago');
            }

            // Redirigir al checkout de Stripe
            window.location.href = data.checkoutUrl;
        } catch (err: any) {
            showNotif(err.message || 'Error al conectar con el sistema de pago', 'error');
            setLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-ferty-beige pb-24">
            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-6 shadow-sm">
                <button
                    onClick={() => onNavigate('DASHBOARD')}
                    className="flex items-center gap-2 text-ferty-gray text-sm mb-4 hover:text-ferty-dark transition-colors"
                >
                    <ArrowLeft size={16} /> Volver
                </button>
                <h1 className="text-2xl font-bold text-ferty-dark">Activa tu Método</h1>
                <p className="text-sm text-ferty-gray mt-1">
                    Elige el plan que mejor se adapta a ti y empieza hoy.
                </p>
            </div>

            <div className="px-5 pt-6 space-y-6">
                {/* Toggle mensual / completo */}
                <div className="bg-white rounded-2xl p-1.5 flex shadow-sm border border-ferty-beige">
                    <button
                        onClick={() => setPaymentMode('monthly')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${paymentMode === 'monthly'
                                ? 'bg-ferty-rose text-white shadow-sm'
                                : 'text-ferty-gray'
                            }`}
                    >
                        Mensual (×3)
                    </button>
                    <button
                        onClick={() => setPaymentMode('full')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative ${paymentMode === 'full'
                                ? 'bg-ferty-rose text-white shadow-sm'
                                : 'text-ferty-gray'
                            }`}
                    >
                        Método Completo
                        <span className="absolute -top-2 -right-1 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                            AHORRA
                        </span>
                    </button>
                </div>

                {/* Info de duración */}
                <p className="text-xs text-center text-ferty-gray">
                    {paymentMode === 'monthly'
                        ? '3 pagos mensuales · Cancela cuando quieras'
                        : 'Un único pago · Acceso completo a los 3 meses del método'}
                </p>

                {/* Cards de planes */}
                {PLANS.map((plan) => {
                    const price = paymentMode === 'monthly' ? plan.monthlyPrice : plan.fullPrice;
                    const planId = paymentMode === 'monthly' ? plan.monthlyPlanId : plan.fullPlanId;
                    const isLoading = loading === planId;
                    const Icon = plan.icon;
                    const isVip = plan.id === 'vip';

                    return (
                        <div
                            key={plan.id}
                            className={`rounded-[2rem] overflow-hidden shadow-lg ${isVip ? 'ring-2 ring-amber-400' : ''}`}
                        >
                            {/* Header del plan */}
                            <div className={`bg-gradient-to-br ${plan.colorClass} p-6 text-white`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center">
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Plan {plan.name}</h2>
                                        {isVip && (
                                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                                Más completo
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-black">{price}€</span>
                                    <span className="text-sm opacity-80 mb-1">
                                        {paymentMode === 'monthly' ? '/mes' : ' pago único'}
                                    </span>
                                </div>
                                {paymentMode === 'monthly' && (
                                    <p className="text-xs opacity-70 mt-1">
                                        Total: {price * 3}€ en 3 meses
                                    </p>
                                )}
                            </div>

                            {/* Contenido */}
                            <div className="bg-white p-6 space-y-4">
                                <ul className="space-y-2">
                                    {plan.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-sm text-ferty-dark">
                                            <Check size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                            {f}
                                        </li>
                                    ))}
                                    {plan.notIncluded.map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-sm text-ferty-gray line-through opacity-50">
                                            <span className="w-4 h-4 mt-0.5 text-center shrink-0">✕</span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleCheckout(plan)}
                                    disabled={!!loading}
                                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isVip
                                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-90 shadow-md'
                                            : 'bg-gradient-to-r from-ferty-rose to-ferty-coral text-white hover:opacity-90 shadow-md'
                                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                    {isLoading ? (
                                        <><Loader2 size={16} className="animate-spin" /> Redirigiendo...</>
                                    ) : (
                                        <><Crown size={16} /> Contratar Plan {plan.name}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Seguridad */}
                <div className="flex items-center justify-center gap-2 text-xs text-ferty-gray pb-4">
                    <Lock size={12} />
                    Pago seguro con Stripe · Cancela cuando quieras
                </div>
            </div>
        </div>
    );
};

export default CheckoutView;
