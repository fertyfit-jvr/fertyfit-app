import { UserProfile, DailyLog, AppNotification } from '../types';
import { supabase } from './supabase';
import {
    calcularVentanaFertil,
    calcularIMC,
    debeEnviarNotificacionFertilidad,
    DISCLAIMERS
} from './CycleCalculations';

// --- Types ---

export type RuleTrigger = 'DAILY_CHECK' | 'WEIGHT_UPDATE' | 'AGE_CHECK';
export type NotificationType = 'alert' | 'insight' | 'celebration' | 'tip' | 'opportunity';
export type Priority = 1 | 2 | 3;

export interface RuleContext {
    user: UserProfile;
    currentCycleDay?: number;
    previousWeight?: number;
}

export interface Rule {
    id: string;
    trigger: RuleTrigger[];
    type: NotificationType;
    priority: Priority;
    cooldownDays: number;
    condition: (ctx: RuleContext) => boolean;
    getMessage: (ctx: RuleContext) => { title: string; message: string };
}

// --- Helper Functions ---

/**
 * Calcula el día actual del ciclo basado en última regla
 */
function calcularDiaDelCiclo(lastPeriodDate: string | undefined): number {
    if (!lastPeriodDate) return 0;

    const ultimaRegla = new Date(lastPeriodDate);
    const hoy = new Date();
    const diferencia = hoy.getTime() - ultimaRegla.getTime();
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));

    return dias + 1; // Día 1 = primer día de regla
}

/**
 * Calcula fecha esperada de próxima menstruación
 */
function calcularProximaMenstruacion(lastPeriodDate: string, cycleLength: number): Date {
    const fecha = new Date(lastPeriodDate);
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
        trigger: ['DAILY_CHECK'],
        type: 'opportunity',
        priority: 1,
        cooldownDays: 0,
        condition: ({ user, currentCycleDay }) => {
            if (!user.cycleLength || !currentCycleDay) return false;
            if (!debeEnviarNotificacionFertilidad(user.age)) return false;

            const ventana = calcularVentanaFertil(user.cycleLength);
            // Notificar 2 días antes del inicio de ventana fértil
            return currentCycleDay === ventana.inicio - 2;
        },
        getMessage: ({ user }) => {
            const mensaje = user.age >= 45
                ? "En 2 días comenzarán tus días más fértiles. Recuerda que después de los 45 años la fertilidad disminuye significativamente y los riesgos en el embarazo aumentan."
                : "En 2 días comenzarán tus días más fértiles del ciclo. Prepárate.";

            return {
                title: '🌸 Tu ventana fértil se acerca',
                message: mensaje + '\n\n' + DISCLAIMERS.ventanaFertil
            };
        }
    },

    {
        id: 'VF-2',
        trigger: ['DAILY_CHECK'],
        type: 'opportunity',
        priority: 1,
        cooldownDays: 0,
        condition: ({ user, currentCycleDay }) => {
            if (!user.cycleLength || !currentCycleDay) return false;
            if (!debeEnviarNotificacionFertilidad(user.age)) return false;

            const ventana = calcularVentanaFertil(user.cycleLength);
            // Día de ovulación estimado
            return currentCycleDay === ventana.diaOvulacion;
        },
        getMessage: ({ user }) => {
            const mensaje = user.age >= 45
                ? "Hoy es tu día más fértil, aunque a esta edad la probabilidad de concepción es menor. Consulta con tu médico sobre tu salud reproductiva."
                : "Hoy es día de alta fertilidad. Los días de mayor probabilidad son 1-2 días antes de la ovulación (33%).";

            return {
                title: '✨ Día de máxima fertilidad',
                message: mensaje + '\n\n' + DISCLAIMERS.ovulacion
            };
        }
    },

    {
        id: 'VF-3',
        trigger: ['DAILY_CHECK'],
        type: 'insight',
        priority: 2,
        cooldownDays: 0,
        condition: ({ user, currentCycleDay }) => {
            if (!user.cycleLength || !currentCycleDay) return false;
            if (!debeEnviarNotificacionFertilidad(user.age)) return false;

            const ventana = calcularVentanaFertil(user.cycleLength);
            // 1 día después de ovulación
            return currentCycleDay === ventana.fin + 1;
        },
        getMessage: () => ({
            title: '⏰ Fin de ventana fértil',
            message: 'Tu ventana fértil terminó. Tu próxima oportunidad será en tu siguiente ciclo.\n\n' + DISCLAIMERS.ventanaFertil
        })
    },

    // ============================================================================
    // PRÓXIMA MENSTRUACIÓN
    // ============================================================================

    {
        id: 'PM-1',
        trigger: ['DAILY_CHECK'],
        type: 'insight',
        priority: 2,
        cooldownDays: 0,
        condition: ({ user, currentCycleDay }) => {
            if (!user.cycleLength || !currentCycleDay) return false;

            // 2 días antes de fecha esperada
            return currentCycleDay === user.cycleLength - 2;
        },
        getMessage: ({ user }) => {
            if (!user.lastPeriodDate || !user.cycleLength) {
                return {
                    title: '📅 Se acerca tu menstruación',
                    message: 'Tu próximo período se espera en aproximadamente 2 días.'
                };
            }

            const fechaEsperada = calcularProximaMenstruacion(user.lastPeriodDate, user.cycleLength);
            const fechaFormateada = fechaEsperada.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long'
            });

            return {
                title: '📅 Se acerca tu menstruación',
                message: `Tu próximo período se espera en aproximadamente 2 días (${fechaFormateada}).`
            };
        }
    },

    {
        id: 'PM-2',
        trigger: ['DAILY_CHECK'],
        type: 'alert',
        priority: 1,
        cooldownDays: 0,
        condition: ({ user, currentCycleDay }) => {
            if (!user.cycleLength || !currentCycleDay) return false;

            // 3 días después de fecha esperada
            return currentCycleDay === user.cycleLength + 3;
        },
        getMessage: () => ({
            title: '🤔 Actualiza tu registro',
            message: 'No has registrado tu menstruación. ¿Ya llegó? Mantén tu calendario actualizado para mejores predicciones.\n\nPor favor, actualiza la fecha de tu última regla en tu perfil.'
        })
    },

    // ============================================================================
    // IMC (ÍNDICE DE MASA CORPORAL)
    // ============================================================================

    {
        id: 'IMC-1',
        trigger: ['WEIGHT_UPDATE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 7, // Solo notificar si cambió de categoría hace más de 7 días
        condition: ({ user, previousWeight }) => {
            if (!previousWeight || !user.weight || !user.height) return false;

            const imcAnterior = calcularIMC(previousWeight, user.height);
            const imcNuevo = calcularIMC(user.weight, user.height);

            // Solo notificar si cambió de categoría
            return imcAnterior.categoria !== imcNuevo.categoria;
        },
        getMessage: ({ user }) => {
            const resultado = calcularIMC(user.weight, user.height);

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
                message: mensaje + '\n\n' + DISCLAIMERS.imc
            };
        }
    },

    // ============================================================================
    // EDAD ≥ 50 AÑOS
    // ============================================================================

    {
        id: 'EDAD-1',
        trigger: ['AGE_CHECK'],
        type: 'alert',
        priority: 1,
        cooldownDays: 365, // Solo una vez al año
        condition: ({ user }) => {
            return user.age >= 50;
        },
        getMessage: () => ({
            title: '🌸 Programa de Menopausia',
            message: 'A los 50 años, la mayoría de mujeres están en menopausia o perimenopausia. El embarazo natural es extremadamente raro y conlleva riesgos significativos.\n\nTe invitamos a conocer nuestro programa especializado en menopausia, donde te acompañamos en esta nueva etapa de tu vida.\n\n' + DISCLAIMERS.edad
        })
    }
];

// ============================================================================
// EVALUATION LOGIC
// ============================================================================

/**
 * Evalúa las reglas aplicables para un trigger específico
 */
export const evaluateRules = async (
    trigger: RuleTrigger,
    context: RuleContext
): Promise<AppNotification[]> => {
    console.log(`🔍 Evaluating Rules for Trigger: ${trigger}`);

    const applicableRules = RULES.filter(r => r.trigger.includes(trigger));
    console.log(`📋 Found ${applicableRules.length} applicable rules`);

    const newNotifications: AppNotification[] = [];

    for (const rule of applicableRules) {
        try {
            const conditionMet = rule.condition(context);

            if (conditionMet) {
                // Check Cooldown
                const inCooldown = await checkCooldown(rule.id, context.user.id!, rule.cooldownDays);
                if (!inCooldown) {
                    console.log(`  🚀 Triggering Rule ${rule.id}`);
                    const { title, message } = rule.getMessage(context);

                    newNotifications.push({
                        id: 0,
                        user_id: context.user.id!,
                        title,
                        message,
                        type: rule.type,
                        priority: rule.priority,
                        is_read: false,
                        created_at: new Date().toISOString(),
                        metadata: { ruleId: rule.id }
                    });
                } else {
                    console.log(`  ⏳ Rule ${rule.id} in cooldown`);
                }
            }
        } catch (err) {
            console.error(`Error evaluating rule ${rule.id}:`, err);
        }
    }

    console.log(`🔔 Generated ${newNotifications.length} notifications`);
    return newNotifications.sort((a, b) => a.priority - b.priority);
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
        console.log('Daily notification limit reached. Skipping.');
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
 * Función helper para calcular día del ciclo (exportada para uso en App)
 */
export { calcularDiaDelCiclo };
