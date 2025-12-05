import { UserProfile, AppNotification, NotificationAction, NotificationType, DailyLog, CourseModule } from '../types';
import { supabase } from './supabase';
import { logger } from '../lib/logger';
import { createNotificationsForUser, updateProfileForUser } from './userDataService';
import {
    calcularVentanaFertil,
    calcularIMC,
    debeEnviarNotificacionFertilidad,
    DISCLAIMERS,
    calcularCicloPromedio
} from './CycleCalculations';
import { parseLocalDate } from './dateUtils';
import {
    FormsStatus,
    Last7DaysStats,
    LearnProgress,
    calculateDaysSinceLastDailyLog
} from './ruleContextHelpers';

// --- Types ---

// MVP: Simplificado a solo DAILY_CHECK
export type Trigger = 'DAILY_CHECK';
export type Priority = 1 | 2 | 3;

export interface RuleContext {
    user: UserProfile;
    // Ciclo
    currentCycleDay?: number;
    cycleLength?: number;
    ventanaFertil?: { inicio: number; diaOvulacion: number; fin: number };
    // Adherencia
    daysSinceLastDailyLog?: number;
    dailyLogStreak?: number;
    last7DaysStats?: Last7DaysStats;
    // Formularios
    formsStatus?: FormsStatus;
    // Aprende
    learnProgress?: LearnProgress;
    // Resúmenes
    lastWeeklySummaryAt?: string | null;
    lastMonthlySummaryAt?: string | null;
    previousWeight?: number;
}

export interface AppNotificationInput {
    title: string;
    message: string;
    type: NotificationType;
    priority: Priority;
    metadata?: Record<string, any>;
}

export interface Rule {
    id: string;
    trigger: Trigger;
    priority: Priority; // Prioridad para ordenamiento
    requiresCycle?: boolean;
    condition: (ctx: RuleContext) => boolean;
    buildNotification: (ctx: RuleContext) => AppNotificationInput;
}

// MVP: Límites por trigger - Solo DAILY_CHECK con máximo 3 notificaciones diarias
export const TRIGGER_MAX: Record<Trigger, number> = {
    DAILY_CHECK: 3,
};

/**
 * Calcula fecha esperada de próxima menstruación
 */
function calcularProximaMenstruacion(lastPeriodDate: string, cycleLength: number): Date {
    const fecha = parseLocalDate(lastPeriodDate) ?? new Date();
    fecha.setDate(fecha.getDate() + cycleLength);
    return fecha;
}

// --- RULES CATALOG ---
// MVP: Simplificado a solo 5 reglas esenciales para el MVP

export const RULES: Rule[] = [
    // ============================================================================
    // VENTANA FÉRTIL (2 reglas)
    // ============================================================================

    {
        id: 'VF-1',
        trigger: 'DAILY_CHECK',
        priority: 1,
        requiresCycle: true,
        condition: (ctx) => {
            if (!ctx.currentCycleDay || !ctx.ventanaFertil) return false;
            if (!debeEnviarNotificacionFertilidad(ctx.user.age)) return false;
            return ctx.currentCycleDay === ctx.ventanaFertil.inicio - 2;
        },
        buildNotification: () => ({
            title: 'Tu ventana fértil está cerca',
            message: 'En 2 días comienza tu ventana fértil. Es un buen momento para observar tus señales y preparar tu ciclo.',
            type: 'opportunity',
            priority: 1
        })
    },

    {
        id: 'VF-2',
        trigger: 'DAILY_CHECK',
        priority: 1,
        requiresCycle: true,
        condition: (ctx) => {
            if (!ctx.currentCycleDay || !ctx.ventanaFertil) return false;
            if (!debeEnviarNotificacionFertilidad(ctx.user.age)) return false;
            return ctx.currentCycleDay === ctx.ventanaFertil.diaOvulacion;
        },
        buildNotification: () => ({
            title: 'Hoy es tu pico de fertilidad',
            message: 'Estás en el día de mayor probabilidad de embarazo de tu ciclo. Escucha a tu cuerpo y cuídalo especialmente hoy.',
            type: 'opportunity',
            priority: 1
        })
    },

    // ============================================================================
    // PRÓXIMA MENSTRUACIÓN (2 reglas)
    // ============================================================================

    {
        id: 'CYCLE-1',
        trigger: 'DAILY_CHECK',
        priority: 1,
        requiresCycle: true,
        condition: (ctx) => {
            if (!ctx.currentCycleDay || !ctx.cycleLength) return false;
            // Excluir el día cycleLength + 5 (ese día se usa PM-2)
            return ctx.currentCycleDay >= ctx.cycleLength 
                && ctx.currentCycleDay !== ctx.cycleLength + 5;
        },
        buildNotification: (ctx) => {
            const diasRetraso = ctx.currentCycleDay && ctx.cycleLength
                ? ctx.currentCycleDay - ctx.cycleLength
                : 0;

            const message = diasRetraso === 0
                ? `Tu ciclo promedio de ${ctx.cycleLength} días ha concluido. Confírmalo para ajustar tu ciclo y mejorar tus informes.`
                : `Tu ciclo promedio de ${ctx.cycleLength} días ha concluido hace ${diasRetraso} día${diasRetraso > 1 ? 's' : ''}. Confírmalo para ajustar tu ciclo y mejorar tus informes.`;

            return {
                title: '¿Te vino la regla hoy?',
                message,
                type: 'confirmation',
                priority: 1,
                metadata: {
                    actions: [
                        { label: 'Sí, me vino', value: 'today', handler: 'handlePeriodConfirmed' },
                        { label: 'No, aún no', value: String(diasRetraso + 1), handler: 'handlePeriodDelayed' }
                    ]
                }
            };
        }
    },

    {
        id: 'PM-2',
        trigger: 'DAILY_CHECK',
        priority: 1,
        requiresCycle: true,
        condition: (ctx) => {
            if (!ctx.currentCycleDay || !ctx.cycleLength) return false;
            return ctx.currentCycleDay === ctx.cycleLength + 5;
        },
        buildNotification: (ctx) => {
            const diasRetraso = ctx.currentCycleDay && ctx.cycleLength
                ? ctx.currentCycleDay - ctx.cycleLength
                : 5;

            return {
                title: 'Tu menstruación se ha retrasado',
                message: 'Han pasado 5 días desde la fecha esperada. ¿Quieres actualizar tu ciclo?',
                type: 'alert',
                priority: 1,
                metadata: {
                    actions: [
                        { label: 'Sí, me vino', value: 'today', handler: 'handlePeriodConfirmed' },
                        { label: 'No, aún no', value: String(diasRetraso + 1), handler: 'handlePeriodDelayed' }
                    ]
                }
            };
        }
    },

    // ============================================================================
    // ADHERENCIA (1 regla)
    // ============================================================================

    {
        id: 'ENG-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        condition: (ctx) => (ctx.daysSinceLastDailyLog ?? 999) >= 3,
        buildNotification: () => ({
            title: 'Te echamos de menos en tu registro',
            message: 'Hace 3 días que no registras tu ciclo. Volver a hacerlo hará tu FertyScore más preciso.',
            type: 'alert',
            priority: 2
        })
    },

];

// ============================================================================
// EVALUATION LOGIC
// ============================================================================

/**
 * Obtiene todas las notificaciones activas (no eliminadas) creadas HOY para un usuario
 * OPTIMIZACIÓN: Una sola consulta para todas las reglas en lugar de una por regla
 */
const getActiveNotificationsToday = async (userId: string): Promise<Set<string>> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = tomorrow.toISOString();

    const { data, error } = await supabase
        .from('notifications')
        .select('metadata')
        .eq('user_id', userId)
        .gte('created_at', todayStart)    // Creada hoy
        .lt('created_at', tomorrowStart)  // Pero antes de mañana
        .limit(50);  // Suficiente para todas las reglas posibles

    if (error) {
        logger.error('Error checking active notifications:', error);
        return new Set(); // En caso de error, retornar set vacío (permitir crear)
    }

    if (!data || data.length === 0) {
        return new Set();
    }

    // Filtrar en cliente: solo las que NO están eliminadas y tienen ruleId
    const activeRuleIds = data
        .filter(n => !n.metadata?.deleted && n.metadata?.ruleId)
        .map(n => n.metadata.ruleId as string);
    
    return new Set(activeRuleIds);
};

/**
 * Evalúa las reglas aplicables para un trigger específico
 */
export const evaluateRules = async (
    trigger: Trigger,
    context: RuleContext,
    userId: string
): Promise<void> => {
    logger.log(`🔍 Evaluating Rules for Trigger: ${trigger}`);

    const rulesForTrigger = RULES.filter(r => r.trigger === trigger);
    logger.log(`📋 Found ${rulesForTrigger.length} applicable rules`);

    // ✅ OPTIMIZACIÓN: Una sola consulta para todas las reglas
    const activeRuleIdsToday = await getActiveNotificationsToday(userId);
    logger.log(`📊 Active notifications today: ${activeRuleIdsToday.size} rules`);

    const preCandidates: AppNotificationInput[] = [];

    for (const rule of rulesForTrigger) {
        try {
            if (rule.requiresCycle) {
                if (!context.currentCycleDay || !context.cycleLength || !context.ventanaFertil) {
                    continue;
                }
            }

            const conditionMet = rule.condition(context);
            if (!conditionMet) continue;

            // ✅ Verificar en memoria (más rápido, menos llamadas a Supabase)
            if (activeRuleIdsToday.has(rule.id)) {
                logger.log(`  ⏭️ Rule ${rule.id} already has active notification today, skipping`);
                continue;
            }

            logger.log(`  🚀 Triggering Rule ${rule.id}`);
            const notif = rule.buildNotification(context);
            preCandidates.push({
                ...notif,
                metadata: { ...(notif.metadata || {}), ruleId: rule.id }
            });
        } catch (err) {
            logger.error(`Error evaluating rule ${rule.id}:`, err);
        }
    }

    if (!preCandidates.length) {
        logger.log(`🔔 No notifications generated for ${trigger}`);
        return;
    }

    // Ordenar por prioridad y limitar
    preCandidates.sort((a, b) => a.priority - b.priority);
    
    const max = TRIGGER_MAX[trigger];
    const finalNotifs = preCandidates.slice(0, max);
    const notifications: AppNotification[] = finalNotifs.map(notif => ({
        id: 0,
        user_id: userId,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        priority: notif.priority,
        is_read: false,
        created_at: new Date().toISOString(),
        metadata: notif.metadata
    }));

    await saveNotifications(userId, notifications);
    logger.log(`🔔 Generated and saved ${notifications.length} notifications for ${trigger}`);
};

/**
 * Guarda notificaciones en la base de datos respetando límite diario
 */
export const saveNotifications = async (userId: string, notifications: AppNotification[]) => {
    if (notifications.length === 0) return;

    const notificationsToCreate = notifications.map(n => ({
        user_id: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        metadata: n.metadata
    }));

    const result = await createNotificationsForUser(userId, notificationsToCreate);
    
    if (!result.success) {
        logger.error('Failed to save notifications:', result.error);
    } else {
        logger.log(`Successfully created ${result.data} notifications`);
    }
};

/**
 * Actualiza la fecha de última menstruación del perfil
 */
export const handlePeriodConfirmed = async (userId: string, newPeriodDate: string) => {
    const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('last_period_date, cycle_length, period_history')
        .eq('id', userId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`handlePeriodConfirmed fetch failed: ${fetchError.message}`);
    }

    const currentHistory = (profileData?.period_history as string[]) || [];
    const updatedHistory = currentHistory.includes(newPeriodDate)
        ? currentHistory
        : [newPeriodDate, ...currentHistory].slice(0, 12);

    let newCycleLength = profileData?.cycle_length || 28;
    if (updatedHistory.length >= 2) {
        const sortedHistory = [...updatedHistory].sort((a, b) => 
            new Date(a).getTime() - new Date(b).getTime()
        );
        const cicloCalculado = calcularCicloPromedio(sortedHistory);
        if (cicloCalculado >= 21 && cicloCalculado <= 45) {
            newCycleLength = cicloCalculado;
        }
    }
    const updateResult = await updateProfileForUser(userId, {
        last_period_date: newPeriodDate,
        period_history: updatedHistory,
        cycle_length: newCycleLength
    });

    if (!updateResult.success) {
        throw new Error(`handlePeriodConfirmed update failed: ${updateResult.error}`);
    }

    logger.log(`✅ Período confirmado: ${newPeriodDate}. Ciclo promedio actualizado: ${newCycleLength} días`);
    
    return { newPeriodDate, newCycleLength, periodHistory: updatedHistory };
};

/**
 * Calcula la duración promedio del ciclo basado en historial
 * Usa el historial de períodos si está disponible, sino usa el cycleLength actual
 */
export const calcularDuracionPromedioCiclo = async (userId: string, currentCycleLength?: number): Promise<number> => {
    try {
        // Intentar obtener historial de períodos
        const { data } = await supabase
            .from('profiles')
            .select('period_history')
            .eq('id', userId)
            .single();

        const periodHistory = (data?.period_history as string[]) || [];
        
        // Si hay historial con al menos 2 períodos, calcular promedio real
        if (periodHistory.length >= 2) {
            const sortedHistory = [...periodHistory].sort((a, b) => 
                new Date(a).getTime() - new Date(b).getTime()
            );
            return calcularCicloPromedio(sortedHistory);
        }
        
        // Si no hay historial suficiente, usar cycleLength actual o default
        return currentCycleLength || 28;
    } catch (error) {
        logger.warn('Error calculando ciclo promedio desde historial, usando valor por defecto:', error);
        return currentCycleLength || 28;
    }
};

/**
 * Ajusta la duración promedio del ciclo ante un retraso reportado
 * Incrementa el cycleLength en los días de retraso
 */
export const handlePeriodDelayed = async (userId: string, daysToAdd: number, fallbackLength = 28) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('cycle_length')
        .eq('id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw new Error(`handlePeriodDelayed fetch failed: ${error.message}`);
    }

    const baseLength = data?.cycle_length ?? fallbackLength;
    const newCycleLength = baseLength + daysToAdd;

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ cycle_length: newCycleLength })
        .eq('id', userId);

    if (updateError) {
        throw new Error(`handlePeriodDelayed update failed: ${updateError.message}`);
    }

    return newCycleLength;
};
