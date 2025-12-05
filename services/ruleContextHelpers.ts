/**
 * Helpers para construir RuleContext
 * Calcula estados de formularios, adherencia, hábitos, etc.
 */

import { UserProfile, DailyLog, CourseModule } from '../types';
import { supabase } from './supabase';
import { logger } from '../lib/logger';
import { parseLocalDate } from './dateUtils';

export type FormState = 'not_started' | 'partial' | 'complete';

export interface FormStatus {
  state: FormState;
  lastUpdatedAt?: string | null;
  completionPercent?: number;
}

export interface FormsStatus {
  f0: FormStatus;
  function: FormStatus;
  food: FormStatus;
  flora: FormStatus;
  flow: FormStatus;
}

export interface Last7DaysStats {
  avgSleepHours?: number;
  avgStressLevel?: number;
  alcoholDays?: number;
}

export interface LearnProgress {
  daysSinceLastLearn?: number;
  modulesStartedNotCompleted?: string[];
}

/**
 * Calcula el estado de un formulario basado en si existe y está completo
 */
async function calculateFormStatus(
  userId: string,
  formType: 'F0' | 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW'
): Promise<FormStatus> {
  try {
    // Para F0, verificar si hay un perfil con datos básicos
    if (formType === 'F0') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('age, weight, height, last_period_date, updated_at')
        .eq('id', userId)
        .single();

      if (!profile) {
        return { state: 'not_started' };
      }

      // F0 se considera completo si tiene: age, weight, height, lastPeriodDate
      const hasRequired = profile.age && profile.weight && profile.height && profile.last_period_date;
      
      if (hasRequired) {
        return {
          state: 'complete',
          lastUpdatedAt: profile.updated_at,
          completionPercent: 100
        };
      }

      // Si tiene algunos datos pero no todos, es partial
      const hasSome = profile.age || profile.weight || profile.height;
      return {
        state: hasSome ? 'partial' : 'not_started',
        lastUpdatedAt: profile.updated_at,
        completionPercent: hasSome ? 50 : 0
      };
    }

    // Para pilares, verificar en pillar_* tables
    const tableName = `pillar_${formType.toLowerCase()}`;
    const { data: pillarData } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!pillarData) {
      return { state: 'not_started' };
    }

    // Verificar si tiene datos significativos (no solo user_id)
    const keys = Object.keys(pillarData).filter(k => k !== 'user_id' && k !== 'created_at' && k !== 'updated_at');
    const hasData = keys.some(key => {
      const value = pillarData[key];
      return value !== null && value !== undefined && value !== '';
    });

    if (!hasData) {
      return { state: 'not_started' };
    }

    // Para determinar si está completo, necesitaríamos la definición del formulario
    // Por ahora, si tiene datos, lo consideramos partial o complete
    // Podríamos mejorar esto calculando el porcentaje real
    return {
      state: 'partial', // Asumimos partial si tiene datos, se puede mejorar
      lastUpdatedAt: pillarData.updated_at,
      completionPercent: 75 // Estimación
    };
  } catch (error) {
    logger.error(`Error calculating form status for ${formType}:`, error);
    return { state: 'not_started' };
  }
}

/**
 * Calcula SOLO el estado del formulario F0 (optimizado para MVP)
 * Evita calcular todos los pilares cuando solo necesitamos F0
 */
export async function calculateF0Status(userId: string): Promise<FormStatus> {
  return calculateFormStatus(userId, 'F0');
}

/**
 * Calcula el estado de todos los formularios
 */
export async function calculateFormsStatus(userId: string): Promise<FormsStatus> {
  const [f0, functionForm, food, flora, flow] = await Promise.all([
    calculateFormStatus(userId, 'F0'),
    calculateFormStatus(userId, 'FUNCTION'),
    calculateFormStatus(userId, 'FOOD'),
    calculateFormStatus(userId, 'FLORA'),
    calculateFormStatus(userId, 'FLOW')
  ]);

  return { f0, function: functionForm, food, flora, flow };
}

/**
 * Calcula días desde el último registro diario
 */
export function calculateDaysSinceLastDailyLog(logs: DailyLog[]): number {
  if (!logs || logs.length === 0) return 999; // Muchos días si no hay logs

  const sortedLogs = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastLogDate = parseLocalDate(sortedLogs[0].date);
  if (!lastLogDate) return 999;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastLogDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - lastLogDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Calcula el streak de días consecutivos con registros
 */
export function calculateDailyLogStreak(logs: DailyLog[]): number {
  if (!logs || logs.length === 0) return 0;

  const sortedLogs = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedLogs.length; i++) {
    const logDate = parseLocalDate(sortedLogs[i].date);
    if (!logDate) continue;

    logDate.setHours(0, 0, 0, 0);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    if (logDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calcula estadísticas de los últimos 7 días
 */
export function calculateLast7DaysStats(logs: DailyLog[]): Last7DaysStats {
  if (!logs || logs.length === 0) {
    return {};
  }

  const sortedLogs = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last7Days = sortedLogs.slice(0, 7);

  const sleepValues = last7Days
    .map(l => l.sleepHours)
    .filter((h): h is number => typeof h === 'number' && h > 0);

  const stressValues = last7Days
    .map(l => l.stressLevel)
    .filter((s): s is number => typeof s === 'number' && s > 0);

  const alcoholDays = last7Days.filter(l => l.alcohol === true).length;

  return {
    avgSleepHours: sleepValues.length > 0
      ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
      : undefined,
    avgStressLevel: stressValues.length > 0
      ? stressValues.reduce((a, b) => a + b, 0) / stressValues.length
      : undefined,
    alcoholDays
  };
}

/**
 * Calcula progreso de aprendizaje
 */
export async function calculateLearnProgress(
  userId: string,
  courseModules: CourseModule[]
): Promise<LearnProgress> {
  try {
    // Obtener última lección completada
    const { data: progressData } = await supabase
      .from('user_progress')
      .select('lesson_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    let daysSinceLastLearn: number | undefined;
    if (progressData && progressData.length > 0) {
      const lastLearnDate = parseLocalDate(progressData[0].created_at);
      if (lastLearnDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastLearnDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - lastLearnDate.getTime();
        daysSinceLastLearn = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Encontrar módulos iniciados pero no completados
    const completedLessonIds = new Set(
      progressData?.map(p => p.lesson_id) || []
    );

    const modulesStartedNotCompleted: string[] = [];
    for (const module of courseModules) {
      const moduleLessons = module.lessons || [];
      const hasStarted = moduleLessons.some(lesson => 
        completedLessonIds.has(lesson.id)
      );
      const isCompleted = moduleLessons.every(lesson =>
        completedLessonIds.has(lesson.id)
      );

      if (hasStarted && !isCompleted) {
        modulesStartedNotCompleted.push(module.title);
      }
    }

    return {
      daysSinceLastLearn,
      modulesStartedNotCompleted: modulesStartedNotCompleted.length > 0
        ? modulesStartedNotCompleted
        : undefined
    };
  } catch (error) {
    logger.error('Error calculating learn progress:', error);
    return {};
  }
}

/**
 * Obtiene fechas de últimos resúmenes
 */
export async function getLastSummaryDates(userId: string): Promise<{
  lastWeeklySummaryAt?: string | null;
  lastMonthlySummaryAt?: string | null;
}> {
  try {
    // Buscar notificaciones de resumen (hacer dos queries separadas)
    const [weeklyResult, monthlyResult] = await Promise.all([
      supabase
        .from('notifications')
        .select('created_at')
        .eq('user_id', userId)
        .eq('metadata->>ruleId', 'SUMMARY-WEEKLY-1')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('notifications')
        .select('created_at')
        .eq('user_id', userId)
        .eq('metadata->>ruleId', 'SUMMARY-MONTHLY-1')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ]);

    return {
      lastWeeklySummaryAt: weeklyResult.data?.created_at || null,
      lastMonthlySummaryAt: monthlyResult.data?.created_at || null
    };
  } catch (error) {
    logger.error('Error getting last summary dates:', error);
    return {};
  }
}

