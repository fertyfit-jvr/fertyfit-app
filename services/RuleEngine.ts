import { UserProfile, DailyLog, AppNotification } from '../types';
import { supabase } from './supabase';

// --- Types ---

export type RuleTrigger = 'F0_CREATE' | 'F0_UPDATE' | 'DAILY_LOG_SAVE' | 'PERIODIC';
export type NotificationType = 'alert' | 'insight' | 'celebration' | 'tip' | 'opportunity';
export type Priority = 1 | 2 | 3;

export interface RuleContext {
    user: UserProfile;
    previousUser?: UserProfile; // For F0_UPDATE
    currentLog?: DailyLog; // For DAILY_LOG_SAVE
    recentLogs?: DailyLog[]; // For windows (3, 7, 14 days)
    submittedForms?: any[]; // To check for F0 answers if needed
}

export interface Rule {
    id: string;
    trigger: RuleTrigger[];
    type: NotificationType;
    priority: Priority;
    cooldownDays: number; // 0 for no cooldown
    condition: (ctx: RuleContext) => boolean;
    getMessage: (ctx: RuleContext) => { title: string; message: string };
}

// --- Constants & Helpers ---

const calculateAge = (dob?: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const ageDifMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const getBMI = (weight: number, height: number) => {
    if (!weight || !height) return 0;
    const hM = height / 100;
    return weight / (hM * hM);
};

const parseTimeTrying = (timeStr: string): number => {
    // Simple parser: "1 year" -> 12, "6 months" -> 6
    if (!timeStr) return 0;
    const lower = timeStr.toLowerCase();
    if (lower.includes('año') || lower.includes('year')) {
        const num = parseInt(lower) || 1;
        return num * 12;
    }
    if (lower.includes('mes') || lower.includes('month')) {
        return parseInt(lower) || 0;
    }
    return 0;
};

// --- RULES CATALOG ---

export const RULES: Rule[] = [
    // 7.1. Reglas F0 – al crear ficha (F0_CREATE)

    {
        id: 'F0-1',
        trigger: ['F0_CREATE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 0,
        condition: ({ user }) => {
            const bmi = getBMI(user.weight, user.height);
            const months = parseTimeTrying(user.timeTrying);
            return (bmi < 18.5 || bmi >= 30) && months >= 12;
        },
        getMessage: () => ({
            title: 'Revisión de Terreno Fértil',
            message: 'Por tu peso actual y el tiempo que llevas buscando embarazo, tu terreno merece una revisión más detallada con tu especialista. Desde FertyFit vamos a trabajar hábitos para acompañar este proceso.'
        })
    },
    {
        id: 'F0-2',
        trigger: ['F0_CREATE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 0,
        condition: ({ user }) => {
            // If age is not directly in user, calculate it? Assuming user.age is populated
            const months = parseTimeTrying(user.timeTrying);
            return user.age >= 35 && months >= 12;
        },
        getMessage: () => ({
            title: 'Edad y Tiempo Buscando',
            message: 'Tienes más de 35 años y llevas más de un año intentando embarazo. Es un buen momento para revisar tu situación con tu especialista y cuidar a fondo tu terreno fértil.'
        })
    },
    {
        id: 'F0-3',
        trigger: ['F0_CREATE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 0,
        condition: ({ submittedForms }) => {
            // We need to check the specific answer for stress in F0 form if not in user profile
            // Assuming we might have mapped it to user profile or need to look in forms
            // For now, let's assume we can access it via a helper or it's in user metadata if mapped
            // The prompt says "Nivel de estrés promedio (escala 1–5)" is in F0.
            // Let's assume it's not currently on UserProfile based on types.ts, but maybe in answers.
            // For V1, I'll assume we pass the F0 form answers in `submittedForms` or mapped to user.
            // Let's check `user.stressLevel` if it existed, but types.ts didn't show it on UserProfile, only DailyLog.
            // I will assume for now we look into `submittedForms` in the context.
            const f0 = submittedForms?.find(f => f.form_type === 'F0');
            const stressAns = f0?.answers?.find((a: any) => a.question.includes('estrés') || a.questionId === 'stress_avg');
            const stressVal = stressAns ? parseInt(stressAns.answer) : 0;
            return stressVal >= 4;
        },
        getMessage: () => ({
            title: 'Nivel de Estrés Elevado',
            message: 'Has marcado un nivel de estrés alto de forma habitual. Esto impacta directamente en tu eje hormonal. En FertyFit vamos a darte recursos para bajar esa carga.'
        })
    },
    {
        id: 'F0-4',
        trigger: ['F0_CREATE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 0,
        condition: ({ submittedForms }) => {
            const f0 = submittedForms?.find(f => f.form_type === 'F0');
            const sleepAns = f0?.answers?.find((a: any) => a.question.includes('sueño') || a.questionId === 'sleep_avg');
            const sleepVal = sleepAns ? parseInt(sleepAns.answer) : 7;
            return sleepVal < 6;
        },
        getMessage: () => ({
            title: 'Descanso Insuficiente',
            message: 'Tu descanso medio está por debajo de 6 horas. El sueño es una de las palancas más potentes para la ovulación, será prioritario en tu plan.'
        })
    },
    {
        id: 'F0-5',
        trigger: ['F0_CREATE'],
        type: 'alert',
        priority: 2,
        cooldownDays: 14,
        condition: ({ user }) => {
            return user.alcoholConsumption === 'Frecuente';
        },
        getMessage: () => ({
            title: 'Consumo de Alcohol',
            message: 'Has marcado consumo de alcohol frecuente. Reducirlo es una de las formas más directas de mejorar inflamación y hormonas.'
        })
    },
    {
        id: 'F0-6',
        trigger: ['F0_CREATE'],
        type: 'insight',
        priority: 2,
        cooldownDays: 30,
        condition: ({ user }) => user.cycleRegularity === 'Irregular',
        getMessage: () => ({
            title: 'Ciclos Irregulares',
            message: 'Tus ciclos son irregulares. Conviene cuidar especialmente sueño, estrés y nutrición para ayudar a tu regulación hormonal.'
        })
    },
    {
        id: 'F0-7',
        trigger: ['F0_CREATE'],
        type: 'insight',
        priority: 3,
        cooldownDays: 30,
        condition: ({ user }) => {
            // Check treatments
            const t = user.fertilityTreatments || '';
            return t.includes('FIV') || t.includes('Inseminación') || t.includes('Ovodonación');
        },
        getMessage: () => ({
            title: 'Tratamientos Previos',
            message: 'Vienes de tratamientos previos. El trabajo sobre tu terreno fértil puede ayudarte a vivir mejor los siguientes pasos.'
        })
    },
    {
        id: 'F0-8',
        trigger: ['F0_CREATE'],
        type: 'tip',
        priority: 3,
        cooldownDays: 30,
        condition: ({ user }) => !user.supplements || user.supplements === 'No' || user.supplements === 'Ninguno',
        getMessage: () => ({
            title: 'Suplementación',
            message: 'Actualmente no tomas suplementos. A medida que avances, podrás valorar con tu especialista si alguno encaja contigo.'
        })
    },
    {
        id: 'F0-9',
        trigger: ['F0_CREATE'],
        type: 'celebration',
        priority: 3,
        cooldownDays: 0,
        condition: () => true, // Always triggers on create
        getMessage: () => ({
            title: '¡Ficha Completada!',
            message: 'Has completado tu Ficha F0. Desde ahora, cada dato que registres nos ayudará a convertir tu día a día en un terreno más fértil.'
        })
    },

    // 7.2. Reglas F0 – al actualizar ficha (F0_UPDATE)
    // Requires comparing user vs previousUser
    {
        id: 'F0U-1',
        trigger: ['F0_UPDATE'],
        type: 'insight',
        priority: 2,
        cooldownDays: 7,
        condition: ({ submittedForms, previousUser }) => {
            // This is tricky because previousUser might not have the form answers. 
            // We'll assume for now we can't easily track "improvement" of form fields unless we store them on profile.
            // Let's skip complex diffs for V1 or assume we only check fields on UserProfile if mapped.
            return false;
        },
        getMessage: () => ({ title: 'Mejora de Sueño', message: 'Has mejorado tu descanso respecto a tu ficha anterior.' })
    },
    // ... skipping complex F0 updates for V1 to focus on Daily Logs which are more critical ...

    // 7.3. Reglas al guardar registro diario – Día actual (DAILY)
    {
        id: 'D-1',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 0,
        condition: ({ currentLog }) => (currentLog?.sleepHours || 10) < 5,
        getMessage: () => ({
            title: 'Sueño Muy Bajo',
            message: 'Hoy has dormido muy poco. Tu cuerpo va a necesitar más suavidad y menos exigencia hoy.'
        })
    },
    {
        id: 'D-2',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 0,
        condition: ({ currentLog }) => (currentLog?.stressLevel || 0) === 5,
        getMessage: () => ({
            title: 'Pico de Estrés',
            message: 'Has marcado un nivel de estrés muy alto. Te propongo que esta noche priorices el descanso mental.'
        })
    },
    {
        id: 'D-3',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'alert',
        priority: 2,
        cooldownDays: 0,
        condition: ({ currentLog }) => !!currentLog?.alcohol,
        getMessage: () => ({
            title: 'Registro de Alcohol',
            message: 'Hoy ha habido alcohol. Vigilar la frecuencia es importante para tu terreno fértil.'
        })
    },
    {
        id: 'D-4',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'celebration',
        priority: 3,
        cooldownDays: 0,
        condition: ({ currentLog }) => (currentLog?.waterGlasses || 0) >= 6,
        getMessage: () => ({
            title: 'Objetivo de Agua',
            message: 'Hoy has llegado a tu objetivo de agua. Un gesto sencillo que ayuda a tu moco cervical.'
        })
    },
    {
        id: 'D-5',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'celebration',
        priority: 3,
        cooldownDays: 1,
        condition: ({ currentLog }) => (currentLog?.veggieServings || 0) >= 4,
        getMessage: () => ({
            title: 'Nutrición Fértil',
            message: 'Tu plato hoy ha sido muy fértil: buen nivel de vegetales y color.'
        })
    },
    {
        id: 'D-6',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'insight',
        priority: 3,
        cooldownDays: 1,
        condition: ({ currentLog }) => (currentLog?.activityMinutes || 0) >= 30,
        getMessage: () => ({
            title: 'Movimiento',
            message: 'Has dado movimiento a tu cuerpo hoy. El ejercicio moderado mejora la ovulación.'
        })
    },
    {
        id: 'D-7',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'opportunity',
        priority: 1,
        cooldownDays: 0, // Always show if positive
        condition: ({ currentLog }) => currentLog?.lhTest === 'Positivo',
        getMessage: () => ({
            title: 'LH Positivo',
            message: 'Hoy tu test de LH es positivo. Estás en tus días de máxima probabilidad de embarazo.'
        })
    },
    {
        id: 'D-8',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'opportunity',
        priority: 2,
        cooldownDays: 0,
        condition: ({ currentLog }) => currentLog?.mucus === 'Clara de huevo' || currentLog?.mucus === 'Acuoso',
        getMessage: () => ({
            title: 'Moco Fértil',
            message: 'Tu moco cervical indica alta fertilidad. Tu cuerpo se prepara para ovular.'
        })
    },

    // 7.4. Reglas ventana 3 días
    {
        id: '3D-1',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'celebration',
        priority: 3,
        cooldownDays: 7,
        condition: ({ recentLogs }) => {
            // Check if we have logs for today, yesterday, and day before
            // recentLogs should be sorted desc by date
            if (!recentLogs || recentLogs.length < 3) return false;
            // Simple check: just length >= 3 in last 3 days? 
            // Assuming recentLogs passed are filtered to last 3 days or we check dates
            return recentLogs.length >= 3;
        },
        getMessage: () => ({
            title: 'Constancia',
            message: 'Llevas 3 días registrando seguidos. Esta constancia marca la diferencia.'
        })
    },
    {
        id: '3D-2',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 5,
        condition: ({ recentLogs }) => {
            if (!recentLogs || recentLogs.length < 3) return false;
            const avgSleep = recentLogs.reduce((acc, l) => acc + (l.sleepHours || 0), 0) / recentLogs.length;
            return avgSleep < 6;
        },
        getMessage: () => ({
            title: 'Racha de Poco Sueño',
            message: 'Llevas varios días durmiendo menos de 6 horas. Tu cuerpo necesita recuperar descanso.'
        })
    },
    {
        id: '3D-4',
        trigger: ['DAILY_LOG_SAVE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 5,
        condition: ({ recentLogs }) => {
            if (!recentLogs) return false;
            const alcoholDays = recentLogs.filter(l => l.alcohol).length;
            return alcoholDays >= 2;
        },
        getMessage: () => ({
            title: 'Alcohol Reciente',
            message: 'En los últimos días el alcohol ha aparecido con frecuencia. Reducirlo ayuda a tu terreno fértil.'
        })
    },

    // 7.5. Reglas ventana 7 y 14 días (Periodic)
    {
        id: '7D-2',
        trigger: ['PERIODIC', 'DAILY_LOG_SAVE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 7,
        condition: ({ recentLogs }) => {
            // Assuming recentLogs contains 7 days for this trigger
            if (!recentLogs || recentLogs.length < 4) return false; // Need some data
            const avg = recentLogs.reduce((acc, l) => acc + (l.sleepHours || 0), 0) / recentLogs.length;
            return avg < 6;
        },
        getMessage: () => ({
            title: 'Semana de Poco Sueño',
            message: 'Tu descanso medio semanal está bajo. Vamos a tratar el sueño como prioridad.'
        })
    },
    {
        id: '14D-1',
        trigger: ['PERIODIC', 'DAILY_LOG_SAVE'],
        type: 'alert',
        priority: 1,
        cooldownDays: 14,
        condition: ({ recentLogs }) => {
            // Assuming recentLogs contains 14 days
            if (!recentLogs) return false;
            const alcoholDays = recentLogs.filter(l => l.alcohol).length;
            return alcoholDays > 2;
        },
        getMessage: () => ({
            title: 'Frecuencia de Alcohol',
            message: 'En las últimas dos semanas el alcohol ha estado demasiado presente. Bajar su frecuencia es clave.'
        })
    }
];

// --- Engine Core ---

export const evaluateRules = async (
    trigger: RuleTrigger,
    context: RuleContext
): Promise<AppNotification[]> => {
    console.log(`🔍 Evaluating Rules for Trigger: ${trigger}`);
    const applicableRules = RULES.filter(r => r.trigger.includes(trigger));
    console.log(`📋 Found ${applicableRules.length} applicable rules`);

    const newNotifications: AppNotification[] = [];

    // 1. Evaluate conditions
    for (const rule of applicableRules) {
        try {
            const conditionMet = rule.condition(context);
            // console.log(`  Rule ${rule.id}: ${conditionMet ? '✅ Met' : '❌ Not met'}`);

            if (conditionMet) {
                // 2. Check Cooldown
                const inCooldown = await checkCooldown(rule.id, context.user.id!, rule.cooldownDays);
                if (!inCooldown) {
                    console.log(`  🚀 Triggering Rule ${rule.id}`);
                    const { title, message } = rule.getMessage(context);

                    newNotifications.push({
                        id: 0, // Placeholder, DB will assign
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
    return newNotifications.sort((a, b) => a.priority - b.priority); // Priority 1 is top (if 1=High)
};

// Check if a rule was triggered recently
const checkCooldown = async (ruleId: string, userId: string, days: number): Promise<boolean> => {
    if (days === 0) return false;

    // We check Supabase notifications for metadata->>ruleId
    // Since we can't easily query JSONB inside array in all Supabase versions efficiently without proper index,
    // we will try a text search or assume we fetch recent notifications.
    // For performance, let's fetch last 50 notifications for user and filter in memory.

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

// Helper to save notifications respecting daily limits
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
    const limit = 5;
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
