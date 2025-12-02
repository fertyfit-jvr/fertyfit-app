import { UserProfile, AppNotification, NotificationAction, NotificationMetadata, NotificationType, DailyLog, CourseModule } from '../types';
import { supabase } from './supabase';
import { logger } from '../lib/logger';
import {
    calcularVentanaFertil,
    calcularIMC,
    debeEnviarNotificacionFertilidad,
    DISCLAIMERS,
    calcularCicloPromedio,
    calcularDiaDelCiclo
} from './CycleCalculations';
import { parseLocalDate } from './dateUtils';
import {
    FormsStatus,
    Last7DaysStats,
    LearnProgress,
    calculateFormsStatus,
    calculateDaysSinceLastDailyLog,
    calculateDailyLogStreak,
    calculateLast7DaysStats,
    calculateLearnProgress,
    getLastSummaryDates
} from './ruleContextHelpers';

// --- Types ---

export type Trigger = 'DAILY_CHECK' | 'DAILY_LOG_SAVED' | 'LESSON_COMPLETED' | 'WEIGHT_UPDATE' | 'AGE_CHECK';
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
    // Legacy
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
    priority: Priority; // Prioridad para ordenamiento (no se usa en buildNotification)
    cooldownDays: number;
    requiresCycle?: boolean;
    condition: (ctx: RuleContext) => boolean;
    buildNotification: (ctx: RuleContext) => AppNotificationInput;
}

// Límites por trigger
export const TRIGGER_MAX: Record<Trigger, number> = {
    DAILY_CHECK: 3,
    DAILY_LOG_SAVED: 1,
    LESSON_COMPLETED: 1,
    WEIGHT_UPDATE: 1,
    AGE_CHECK: 1,
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

export const RULES: Rule[] = [
    // ============================================================================
    // VENTANA FÉRTIL
    // ============================================================================

    {
        id: 'VF-1',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 0,
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
        cooldownDays: 0,
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

    {
        id: 'VF-3',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 0,
        requiresCycle: true,
        condition: (ctx) => {
            if (!ctx.currentCycleDay || !ctx.ventanaFertil) return false;
            if (!debeEnviarNotificacionFertilidad(ctx.user.age)) return false;
            return ctx.currentCycleDay === ctx.ventanaFertil.fin + 1;
        },
        buildNotification: () => ({
            title: 'Fin de tu ventana fértil',
            message: 'Tu ventana fértil ha terminado. Ahora tu cuerpo entra en una fase distinta. Te acompañamos paso a paso.',
            type: 'insight',
            priority: 2
        })
    },

    // ============================================================================
    // PRÓXIMA MENSTRUACIÓN
    // ============================================================================

    {
        id: 'CYCLE-1',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 0,
        requiresCycle: true,
        condition: (ctx) => {
            if (!ctx.currentCycleDay || !ctx.cycleLength) return false;
            return ctx.currentCycleDay >= ctx.cycleLength;
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
        id: 'PM-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 0,
        requiresCycle: true,
        condition: (ctx) => {
            if (!ctx.currentCycleDay || !ctx.cycleLength) return false;
            return ctx.currentCycleDay === ctx.cycleLength - 2;
        },
        buildNotification: () => ({
            title: 'Tu menstruación se acerca',
            message: 'Según tu ciclo, tu menstruación podría llegar en 2 días. Si notas cambios, puedes registrarlos.',
            type: 'insight',
            priority: 2
        })
    },

    {
        id: 'PM-2',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 0,
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
    // IMC (ÍNDICE DE MASA CORPORAL)
    // ============================================================================

    {
        id: 'IMC-1',
        trigger: 'WEIGHT_UPDATE',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => {
            if (!ctx.previousWeight || !ctx.user.weight || !ctx.user.height) return false;
            const imcAnterior = calcularIMC(ctx.previousWeight, ctx.user.height);
            const imcNuevo = calcularIMC(ctx.user.weight, ctx.user.height);
            return imcAnterior.categoria !== imcNuevo.categoria;
        },
        buildNotification: (ctx) => {
            const resultado = calcularIMC(ctx.user.weight, ctx.user.height);
            let titulo = '';
            let mensaje = '';

            if (parseFloat(resultado.valor) < 18.5) {
                titulo = '⚠️ Tu IMC está bajo';
                mensaje = `Tu IMC es ${resultado.valor} (bajo peso). ${resultado.impactoFertilidad}. Considera consultar con un nutricionista.`;
            } else if (parseFloat(resultado.valor) >= 25 && parseFloat(resultado.valor) < 30) {
                titulo = '⚖️ Tu IMC indica sobrepeso';
                mensaje = `Tu IMC es ${resultado.valor}. ${resultado.impactoFertilidad}. Pequeños cambios en tu alimentación pueden mejorar tu fertilidad.`;
            } else if (parseFloat(resultado.valor) >= 30) {
                titulo = '⚠️ Tu IMC indica obesidad';
                mensaje = `Tu IMC es ${resultado.valor} (${resultado.categoria}). ${resultado.impactoFertilidad}. Te recomendamos consultar con un especialista en nutrición.`;
            }

            return {
                title: titulo,
                message: mensaje + '\n\n' + DISCLAIMERS.imc,
                type: 'alert',
                priority: 1
            };
        }
    },

    {
        id: 'EDAD-1',
        trigger: 'AGE_CHECK',
        priority: 1,
        cooldownDays: 365,
        condition: (ctx) => ctx.user.age >= 50,
        buildNotification: () => ({
            title: '🌸 Programa de Menopausia',
            message: 'A los 50 años, la mayoría de mujeres están en menopausia o perimenopausia. El embarazo natural es extremadamente raro y conlleva riesgos significativos.\n\nTe invitamos a conocer nuestro programa especializado en menopausia, donde te acompañamos en esta nueva etapa de tu vida.\n\n' + DISCLAIMERS.edad,
            type: 'alert',
            priority: 1
        })
    },

    // ============================================================================
    // FORMULARIOS
    // ============================================================================

    {
        id: 'FORM-F0-NEW',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.f0?.state === 'not_started',
        buildNotification: () => ({
            title: 'Completa tu ficha inicial',
            message: 'Aún no has completado tu ficha de salud. Es clave para personalizar tus informes y tu FertyScore.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-F0-PARTIAL',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.f0?.state === 'partial',
        buildNotification: () => ({
            title: 'Retoma tu ficha de salud',
            message: 'Dejaste tu ficha inicial a medias. Si la completas, podremos entender tu caso con mucha más precisión.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-FUNCTION-NEW',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.function?.state === 'not_started',
        buildNotification: () => ({
            title: 'Aún falta un pilar por completar',
            message: 'Si completas este pilar podremos mejorar tus análisis y ajustar mejor tus recomendaciones.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-FUNCTION-PARTIAL',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.function?.state === 'partial',
        buildNotification: () => ({
            title: 'Termina tu pilar de salud',
            message: 'Veo que empezaste este formulario. Completarlo hará que tus informes y tu FertyScore reflejen tu realidad.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-FOOD-NEW',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.food?.state === 'not_started',
        buildNotification: () => ({
            title: 'Aún falta un pilar por completar',
            message: 'Si completas este pilar podremos mejorar tus análisis y ajustar mejor tus recomendaciones.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-FOOD-PARTIAL',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.food?.state === 'partial',
        buildNotification: () => ({
            title: 'Termina tu pilar de salud',
            message: 'Veo que empezaste este formulario. Completarlo hará que tus informes y tu FertyScore reflejen tu realidad.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-FLORA-NEW',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.flora?.state === 'not_started',
        buildNotification: () => ({
            title: 'Aún falta un pilar por completar',
            message: 'Si completas este pilar podremos mejorar tus análisis y ajustar mejor tus recomendaciones.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-FLORA-PARTIAL',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.flora?.state === 'partial',
        buildNotification: () => ({
            title: 'Termina tu pilar de salud',
            message: 'Veo que empezaste este formulario. Completarlo hará que tus informes y tu FertyScore reflejen tu realidad.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-FLOW-NEW',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.flow?.state === 'not_started',
        buildNotification: () => ({
            title: 'Aún falta un pilar por completar',
            message: 'Si completas este pilar podremos mejorar tus análisis y ajustar mejor tus recomendaciones.',
            type: 'tip',
            priority: 1
        })
    },

    {
        id: 'FORM-FLOW-PARTIAL',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => ctx.formsStatus?.flow?.state === 'partial',
        buildNotification: () => ({
            title: 'Termina tu pilar de salud',
            message: 'Veo que empezaste este formulario. Completarlo hará que tus informes y tu FertyScore reflejen tu realidad.',
            type: 'tip',
            priority: 1
        })
    },

    // ============================================================================
    // ADHERENCIA
    // ============================================================================

    {
        id: 'ENG-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 3,
        condition: (ctx) => (ctx.daysSinceLastDailyLog ?? 999) >= 3,
        buildNotification: () => ({
            title: 'Te echamos de menos en tu registro',
            message: 'Hace 3 días que no registras tu ciclo ni tus hábitos. Volver a hacerlo hará tu FertyScore más preciso.',
            type: 'alert',
            priority: 2
        })
    },

    {
        id: 'ENG-2',
        trigger: 'DAILY_LOG_SAVED',
        priority: 3,
        cooldownDays: 0,
        condition: (ctx) => {
            const streak = ctx.dailyLogStreak ?? 0;
            return streak === 3 || streak === 7 || streak === 14;
        },
        buildNotification: (ctx) => ({
            title: '¡Qué constancia! 🔥',
            message: `Llevas ${ctx.dailyLogStreak} días seguidos registrando tu salud. Este tipo de compromiso marca una gran diferencia.`,
            type: 'celebration',
            priority: 3
        })
    },

    // ============================================================================
    // HÁBITOS (últimos 7 días)
    // ============================================================================

    {
        id: 'HAB-STRESS-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 7,
        condition: (ctx) => {
            const avgStress = ctx.last7DaysStats?.avgStressLevel;
            return avgStress !== undefined && avgStress >= 4;
        },
        buildNotification: () => ({
            title: 'Tu cuerpo pide una pausa',
            message: 'Has tenido varios días de estrés elevado. Esto puede afectar tu ovulación. ¿Revisamos tu pilar FLOW?',
            type: 'alert',
            priority: 2
        })
    },

    {
        id: 'HAB-SLEEP-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 7,
        condition: (ctx) => {
            const avgSleep = ctx.last7DaysStats?.avgSleepHours;
            return avgSleep !== undefined && avgSleep < 6;
        },
        buildNotification: () => ({
            title: 'Tu descanso está bajando',
            message: 'Dormir poco varios días reduce la calidad ovulatoria. Te ayudamos a mejorarlo paso a paso.',
            type: 'alert',
            priority: 2
        })
    },

    {
        id: 'HAB-ALCOHOL-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 7,
        condition: (ctx) => {
            const alcoholDays = ctx.last7DaysStats?.alcoholDays ?? 0;
            return alcoholDays >= 4;
        },
        buildNotification: () => ({
            title: 'Cuida tu fertilidad esta semana',
            message: 'Has consumido alcohol varios días. No pasa nada, pero es un buen momento para volver al equilibrio.',
            type: 'tip',
            priority: 2
        })
    },

    {
        id: 'HAB-COMBO-1',
        trigger: 'DAILY_CHECK',
        priority: 1,
        cooldownDays: 7,
        condition: (ctx) => {
            const stats = ctx.last7DaysStats;
            const highStress = (stats?.avgStressLevel ?? 0) >= 4;
            const lowSleep = (stats?.avgSleepHours ?? 10) < 6;
            const highAlcohol = (stats?.alcoholDays ?? 0) >= 3;
            return highStress && lowSleep && highAlcohol;
        },
        buildNotification: () => ({
            title: 'Tu fertilidad necesita calma',
            message: 'Estrés, poco sueño y alcohol han coincidido esta semana. Te proponemos pautas para recuperar bienestar.',
            type: 'alert',
            priority: 1
        })
    },

    // ============================================================================
    // APRENDE
    // ============================================================================

    {
        id: 'LEARN-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 7,
        condition: (ctx) => {
            const daysSince = ctx.learnProgress?.daysSinceLastLearn;
            const hasIncomplete = (ctx.learnProgress?.modulesStartedNotCompleted?.length ?? 0) > 0;
            return daysSince !== undefined && daysSince >= 7 && hasIncomplete;
        },
        buildNotification: () => ({
            title: 'Retoma tu aprendizaje',
            message: 'Dejaste un módulo a medias. Completarlo te ayudará a entender mejor tu ciclo.',
            type: 'tip',
            priority: 2
        })
    },

    {
        id: 'LEARN-2',
        trigger: 'LESSON_COMPLETED',
        priority: 3,
        cooldownDays: 0,
        condition: () => true,
        buildNotification: () => ({
            title: '¡Módulo completado! 🎉',
            message: 'Has dado un paso importante en tu camino de fertilidad. ¿Quieres ver tu siguiente lección?',
            type: 'celebration',
            priority: 3
        })
    },

    // ============================================================================
    // RESÚMENES
    // ============================================================================

    {
        id: 'SUMMARY-WEEKLY-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 7,
        condition: (ctx) => {
            if (!ctx.lastWeeklySummaryAt) return true; // Nunca se ha enviado
            const lastDate = parseLocalDate(ctx.lastWeeklySummaryAt);
            if (!lastDate) return true;
            const daysSince = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysSince >= 7;
        },
        buildNotification: () => ({
            title: 'Tu resumen semanal está listo',
            message: 'Hemos analizado tu semana. Aquí tienes un informe claro para seguir entendiendo tu fertilidad.',
            type: 'insight',
            priority: 2
        })
    },

    {
        id: 'SUMMARY-MONTHLY-1',
        trigger: 'DAILY_CHECK',
        priority: 2,
        cooldownDays: 28,
        condition: (ctx) => {
            if (!ctx.lastMonthlySummaryAt) return true; // Nunca se ha enviado
            const lastDate = parseLocalDate(ctx.lastMonthlySummaryAt);
            if (!lastDate) return true;
            const daysSince = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysSince >= 28;
        },
        buildNotification: () => ({
            title: 'Informe mensual disponible',
            message: 'Un mes entero de datos. Ya puedes ver tu progreso real en tus pilares y tu FertyScore.',
            type: 'insight',
            priority: 2
        })
    }
];

// ============================================================================
// EVALUATION LOGIC
// ============================================================================

/**
 * Filtra notificaciones de formularios: solo 1 por día según prioridad
 */
function filterFormNotifications(notifs: AppNotificationInput[]): AppNotificationInput[] {
    const forms = notifs.filter(n => n.metadata?.ruleId?.startsWith('FORM-'));
    if (!forms.length) return notifs;

    const ORDER = [
        'FORM-F0-PARTIAL',
        'FORM-F0-NEW',
        'FORM-FUNCTION-PARTIAL',
        'FORM-FOOD-PARTIAL',
        'FORM-FLORA-PARTIAL',
        'FORM-FLOW-PARTIAL',
        'FORM-FUNCTION-NEW',
        'FORM-FOOD-NEW',
        'FORM-FLORA-NEW',
        'FORM-FLOW-NEW',
    ];

    const selected = forms.sort(
        (a, b) => ORDER.indexOf(a.metadata!.ruleId) - ORDER.indexOf(b.metadata!.ruleId)
    )[0];

    const others = notifs.filter(n => !n.metadata?.ruleId?.startsWith('FORM-'));

    return [selected, ...others];
}

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

    const preCandidates: AppNotificationInput[] = [];

    for (const rule of rulesForTrigger) {
        try {
            // Verificar requiresCycle
            if (rule.requiresCycle) {
                if (!context.currentCycleDay || !context.cycleLength || !context.ventanaFertil) {
                    continue;
                }
            }

            const conditionMet = rule.condition(context);
            if (!conditionMet) continue;

            // Check Cooldown
            const inCooldown = await checkCooldown(rule.id, userId, rule.cooldownDays);
            if (inCooldown) {
                logger.log(`  ⏳ Rule ${rule.id} in cooldown`);
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

    // 1) Filtrar notificaciones de formularios (solo 1 por día)
    let filtered = filterFormNotifications(preCandidates);

    // 2) Ordenar por prioridad
    filtered.sort((a, b) => a.priority - b.priority);

    // 3) Límite final por trigger
    const max = TRIGGER_MAX[trigger];
    const finalNotifs = filtered.slice(0, max);

    // 4) Convertir a AppNotification y guardar
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
 * Verifica si una regla está en cooldown
 */
const checkCooldown = async (ruleId: string, userId: string, days: number): Promise<boolean> => {
    if (days === 0) return false;

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data: recentNotifs } = await supabase
        .from('notifications')
        .select('metadata, created_at')
        .eq('user_id', userId)
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: false });

    if (!recentNotifs) return false;

    return recentNotifs.some(n => n.metadata?.ruleId === ruleId);
};

/**
 * Guarda notificaciones en la base de datos respetando límite diario
 */
export const saveNotifications = async (userId: string, notifications: AppNotification[]) => {
    if (notifications.length === 0) return;

    // Check how many sent today
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`);

    const sentToday = count || 0;
    const limit = 30;
    const remaining = limit - sentToday;

    if (remaining <= 0) {
        logger.log('Daily notification limit reached. Skipping.');
        return;
    }

    // Take top N
    const toInsert = notifications.slice(0, remaining);

    for (const n of toInsert) {
        await supabase.from('notifications').insert({
            user_id: n.user_id,
            title: n.title,
            message: n.message,
            type: n.type,
            priority: n.priority,
            metadata: n.metadata
        });
    }
};

/**
 * Actualiza la fecha de última menstruación del perfil
 */
export const handlePeriodConfirmed = async (userId: string, newPeriodDate: string) => {
    // 1. Obtener perfil actual con historial (incluir period_history en la misma query)
    const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('last_period_date, cycle_length, period_history')
        .eq('id', userId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`handlePeriodConfirmed fetch failed: ${fetchError.message}`);
    }

    // 2. Actualizar historial de períodos
    const currentHistory = (profileData?.period_history as string[]) || [];
    let updatedHistory: string[];
    
    // Si ya existe la fecha, no duplicarla; si no, agregarla al inicio (más reciente primero)
    if (currentHistory.includes(newPeriodDate)) {
        updatedHistory = currentHistory;
    } else {
        // Agregar nueva fecha al inicio y mantener solo últimas 12 (para calcular promedio)
        updatedHistory = [newPeriodDate, ...currentHistory].slice(0, 12);
    }

    // 3. Calcular nuevo ciclo promedio solo si hay suficientes períodos (2+)
    // Si hay pocos datos, preservar el cycleLength existente (probablemente de F0)
    // La BD es la fuente de verdad única para cycleLength
    let newCycleLength = profileData?.cycle_length || 28; // Preservar valor existente (puede venir de F0)
    if (updatedHistory.length >= 2) {
        // Ordenar fechas de más antigua a más reciente para el cálculo
        const sortedHistory = [...updatedHistory].sort((a, b) => 
            new Date(a).getTime() - new Date(b).getTime()
        );
        const cicloCalculado = calcularCicloPromedio(sortedHistory);
        // Solo actualizar si el cálculo es válido (rango 21-45 días)
        // Esto permite que el auto-cálculo actualice el ciclo cuando hay suficientes datos
        if (cicloCalculado >= 21 && cicloCalculado <= 45) {
            newCycleLength = cicloCalculado;
        }
        // Si el cálculo no es válido, mantener el cycleLength existente (de F0 o valor previo)
    }

    // 4. Actualizar perfil con nueva fecha, historial y ciclo promedio
    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            last_period_date: newPeriodDate,
            period_history: updatedHistory,
            cycle_length: newCycleLength
        })
        .eq('id', userId);

    if (updateError) {
        throw new Error(`handlePeriodConfirmed update failed: ${updateError.message}`);
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
