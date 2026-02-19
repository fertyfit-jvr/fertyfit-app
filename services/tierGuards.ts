/**
 * Tier Guards — FertyFit
 *
 * Funciones helpers para controlar el acceso por tipo de usuario.
 * Usar en frontend y en reportRules.ts para aplicar restricciones.
 */

import type { UserTier } from '../types';

// ============================================================
// CONSTANTES DE LÍMITES POR TIER
// ============================================================

export const TIER_LIMITS = {
    free: {
        maxDailyLogs: 15,
        maxBasicReports: 1,
        maxDailyReports: 1,
        canAccess360: false,
        canAccessLabs: false,
        canAccessModulesPhase1Plus: false,
        hasSpecialistReview: false,
        hasOnlineConsultation: false,
    },
    premium: {
        maxDailyLogs: Infinity,
        maxBasicReports: Infinity,
        maxDailyReports: Infinity,
        canAccess360: true,
        canAccessLabs: true,
        canAccessModulesPhase1Plus: true,
        hasSpecialistReview: false,
        hasOnlineConsultation: false,
    },
    vip: {
        maxDailyLogs: Infinity,
        maxBasicReports: Infinity,
        maxDailyReports: Infinity,
        canAccess360: true,
        canAccessLabs: true,
        canAccessModulesPhase1Plus: true,
        hasSpecialistReview: true,
        hasOnlineConsultation: true,
    },
} as const;

// ============================================================
// FUNCIONES DE GUARDAS
// ============================================================

/**
 * Obtiene el tier de un usuario, con fallback a 'free'
 */
export function getUserTier(user_type?: string | null): UserTier {
    if (user_type === 'premium' || user_type === 'vip') return user_type;
    return 'free';
}

/**
 * Comprueba si el usuario puede generar más registros diarios
 */
export function canLogDaily(user_type: string | undefined, currentLogsCount: number): boolean {
    const tier = getUserTier(user_type);
    return currentLogsCount < TIER_LIMITS[tier].maxDailyLogs;
}

/**
 * Comprueba si el usuario puede acceder a un tipo de informe
 */
export function canAccessReport(
    user_type: string | undefined,
    reportType: 'BASIC' | 'DAILY' | '360' | 'LABS',
    reportsAlreadyGenerated: number = 0
): boolean {
    const tier = getUserTier(user_type);
    const limits = TIER_LIMITS[tier];

    switch (reportType) {
        case 'BASIC':
            return reportsAlreadyGenerated < limits.maxBasicReports;
        case 'DAILY':
            return reportsAlreadyGenerated < limits.maxDailyReports;
        case '360':
            return limits.canAccess360;
        case 'LABS':
            return limits.canAccessLabs;
        default:
            return false;
    }
}

/**
 * Comprueba si el usuario puede acceder a los módulos educativos de una fase
 */
export function canAccessModule(user_type: string | undefined, phase: number): boolean {
    const tier = getUserTier(user_type);
    if (phase === 0) return true; // Bienvenida siempre disponible
    return TIER_LIMITS[tier].canAccessModulesPhase1Plus;
}

/**
 * Comprueba si el usuario tiene revisión de especialista
 */
export function hasSpecialistReview(user_type: string | undefined): boolean {
    const tier = getUserTier(user_type);
    return TIER_LIMITS[tier].hasSpecialistReview;
}

/**
 * Devuelve el límite de informes para un tier dado
 */
export function getReportLimit(
    user_type: string | undefined,
    reportType: 'BASIC' | 'DAILY'
): number {
    const tier = getUserTier(user_type);
    if (reportType === 'BASIC') return TIER_LIMITS[tier].maxBasicReports;
    if (reportType === 'DAILY') return TIER_LIMITS[tier].maxDailyReports;
    return 0;
}

/**
 * Devuelve el mensaje de bloqueo apropiado para mostrar en la UI
 */
export function getLockedMessage(
    user_type: string | undefined,
    feature: 'logs' | 'report_360' | 'report_labs' | 'modules' | 'basic_report' | 'daily_report'
): string {
    const tier = getUserTier(user_type);

    if (tier !== 'free') return ''; // No bloqueado

    const messages: Record<string, string> = {
        logs: 'Has alcanzado el límite de 15 registros diarios del plan gratuito. Actualiza a Premium o VIP para registros ilimitados.',
        report_360: 'El informe 360° está disponible en los planes Premium y VIP.',
        report_labs: 'Los informes de analíticas están disponibles en los planes Premium y VIP.',
        modules: 'Los módulos de las Fases 1, 2 y 3 están disponibles en los planes Premium y VIP.',
        basic_report: 'Ya has utilizado tu informe básico gratuito. Actualiza tu plan para generar más informes.',
        daily_report: 'Ya has utilizado tu informe de registros diarios gratuito. Actualiza tu plan para continuar.',
    };

    return messages[feature] || 'Esta función requiere un plan Premium o VIP.';
}
