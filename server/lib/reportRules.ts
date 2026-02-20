/**
 * Report Rules Engine
 * 
 * Funciones de verificación para determinar cuándo se deben generar los informes.
 * Estas reglas se aplican SOLO a generación automática.
 * Los triggers manuales (manualTrigger=true) bypasean estas reglas.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../../server/lib/logger.js';

// Supabase client (usar SERVICE ROLE KEY para bypassear RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL o SERVICE ROLE KEY no están configuradas');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ============================================================================
// TIPOS
// ============================================================================

export interface ReportValidationResult {
  canGenerate: boolean;
  reason?: string;
  warnings?: string[];
}

export interface DailyReportCheck {
  shouldGenerate: boolean;
  reason?: string;
  daysSinceMethodStart?: number;
  logsCount?: number;
}

export interface Report360Check {
  shouldGenerate: boolean;
  reason?: string;
  dayOfMonth?: number;
  alreadyGeneratedThisMonth?: boolean;
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Cuenta cuántos informes BASIC se han generado históricamente (Total)
 */
async function getTotalBasicReports(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'REPORT')
    .contains('metadata', { report_type: 'BASIC' });

  if (error) {
    logger.error('Error counting total BASIC reports:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Cuenta cuántos informes DAILY se han generado históricamente (Total)
 */
async function getTotalDailyReports(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'REPORT')
    .contains('metadata', { report_type: 'DAILY' });

  if (error) {
    logger.error('Error counting total DAILY reports:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Verifica si todos los formularios básicos existen (F0 + 4 pilares)
 */
async function hasAllBasicForms(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('consultation_forms')
    .select('form_type')
    .eq('user_id', userId)
    .in('form_type', ['F0', 'FUNCTION', 'FOOD', 'FLORA', 'FLOW']);

  if (error) {
    logger.error('Error checking forms:', error);
    return false;
  }

  if (!data || data.length === 0) return false;

  const formTypes = new Set(data.map(f => f.form_type));
  return (
    formTypes.has('F0') &&
    formTypes.has('FUNCTION') &&
    formTypes.has('FOOD') &&
    formTypes.has('FLORA') &&
    formTypes.has('FLOW')
  );
}

/**
 * Obtiene días transcurridos desde method_start_date
 */
async function getDaysSinceMethodStart(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('method_start_date')
    .eq('id', userId)
    .single();

  if (error || !data?.method_start_date) {
    return null;
  }

  const methodStart = new Date(data.method_start_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  methodStart.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - methodStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Cuenta registros diarios en los últimos N días
 */
async function countRecentDailyLogs(userId: string, days: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { count, error } = await supabase
    .from('daily_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('date', cutoffDate.toISOString().split('T')[0]); // Format: YYYY-MM-DD

  if (error) {
    logger.error('Error counting daily logs:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Verifica si ya se generó un informe de cierto tipo este mes
 */
async function wasReportGeneratedThisMonth(
  userId: string,
  reportType: string
): Promise<boolean> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'REPORT')
    .contains('metadata', { report_type: reportType })
    .gte('created_at', startOfMonth.toISOString())
    .limit(1);

  if (error) {
    logger.error('Error checking report this month:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Obtiene el method_start_date de un usuario
 */
async function getMethodStartDate(userId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('method_start_date')
    .eq('id', userId)
    .single();

  if (error || !data?.method_start_date) {
    return null;
  }

  return new Date(data.method_start_date);
}

// ============================================================================
// REGLAS PRINCIPALES
// ============================================================================

/**
 * INFORME BÁSICO (BASIC)
 * 
 * Reglas:
 * - Todos los formularios deben existir (F0 + Function + Food + Flora + Flow)
 * - Usuarios Free: BLOQUEADO (Antes era 1 total, ahora cerrado para favorecer Premium)
 * - Usuarios Premium/VIP: Sin límite (se genera al actualizar formularios)
 */
export async function canGenerateBasic(userId: string): Promise<ReportValidationResult> {
  logger.log(`[BASIC] Checking rules for user ${userId}`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  const userTier = profile?.subscription_tier || 'free';

  if (userTier !== 'premium' && userTier !== 'vip') {
    return {
      canGenerate: false,
      reason: 'El Informe Básico de Preconsulta es una función exclusiva para usuarias Premium y VIP.',
    };
  }

  const hasAllForms = await hasAllBasicForms(userId);
  if (!hasAllForms) {
    return {
      canGenerate: false,
      reason: 'Faltan formularios básicos. Necesitas completar F0 y los 4 pilares (Function, Food, Flora, Flow).',
    };
  }

  logger.log(`[BASIC] ✅ Can generate. Tier: ${userTier}`);
  return {
    canGenerate: true,
  };
}

/**
 * INFORME DIARIO (DAILY)
 * 
 * Reglas:
 * - Premium/VIP: Cada 15 días desde method_start_date y 7 registros.
 * - Free: UNA SOLA VEZ cuando alcance 7 registros totales.
 */
export async function shouldGenerateDaily(userId: string): Promise<DailyReportCheck> {
  logger.log(`[DAILY] Checking rules for user ${userId}`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, method_start_date')
    .eq('id', userId)
    .single();

  const userTier = profile?.subscription_tier || 'free';

  // Lógica para USUARIAS FREE (Una sola vez con 7 registros)
  if (userTier === 'free') {
    const totalDailyReports = await getTotalDailyReports(userId);
    if (totalDailyReports >= 1) {
      return {
        shouldGenerate: false,
        reason: 'Límite alcanzado: Las usuarias Free solo pueden generar 1 Informe Diario gratuito. Actualiza a Premium para informes ilimitados.',
      };
    }

    // Para Free miramos el historial total reciente (100 días)
    const logsCount = await countRecentDailyLogs(userId, 100);
    if (logsCount < 7) {
      return {
        shouldGenerate: false,
        reason: `Como usuaria Free, necesitas al menos 7 registros para tu informe gratuito. Llevas ${logsCount}/7.`,
        logsCount,
      };
    }

    logger.log(`[DAILY] ✅ Free user eligible for ONE-TIME report. Logs: ${logsCount}`);
    return {
      shouldGenerate: true,
      logsCount,
    };
  }

  // Lógica para PREMIUM/VIP (Periodicidad de 15 días)
  if (userTier !== 'premium' && userTier !== 'vip') {
    return {
      shouldGenerate: false,
      reason: 'Funcionalidad exclusiva para Premium/VIP',
    };
  }

  const daysSinceMethodStart = (function () {
    if (!profile?.method_start_date) return null;
    const methodStart = new Date(profile.method_start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    methodStart.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - methodStart.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  })();

  if (daysSinceMethodStart === null) {
    return {
      shouldGenerate: false,
      reason: 'Usuario no tiene method_start_date configurado',
    };
  }

  if (daysSinceMethodStart % 15 !== 0) {
    return {
      shouldGenerate: false,
      reason: `No es día de generación. Días desde inicio: ${daysSinceMethodStart}. Próximo informe en ${15 - (daysSinceMethodStart % 15)} días.`,
      daysSinceMethodStart,
    };
  }

  const logsCount = await countRecentDailyLogs(userId, 15);
  if (logsCount < 7) {
    return {
      shouldGenerate: false,
      reason: `Insuficientes registros diarios: ${logsCount}/7 en los últimos 15 días`,
      daysSinceMethodStart,
      logsCount,
    };
  }

  logger.log(`[DAILY] ✅ Should generate. Day ${daysSinceMethodStart}, logs: ${logsCount}`);
  return {
    shouldGenerate: true,
    daysSinceMethodStart,
    logsCount,
  };
}

/**
 * INFORME DE ANALÍTICAS (LABS)
 */
export async function shouldGenerateLabs(userId: string, examId?: number): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  if (profile?.subscription_tier !== 'premium' && profile?.subscription_tier !== 'vip') {
    return false;
  }

  return true;
}

/**
 * INFORME 360
 */
export async function shouldGenerate360(userId: string): Promise<Report360Check> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  if (profile?.subscription_tier !== 'premium' && profile?.subscription_tier !== 'vip') {
    return {
      shouldGenerate: false,
      reason: 'Funcionalidad exclusiva para Premium/VIP',
    };
  }

  const methodStartDate = await getMethodStartDate(userId);
  if (!methodStartDate) {
    return {
      shouldGenerate: false,
      reason: 'Usuario no tiene method_start_date configurado',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDayOfMonth = methodStartDate.getDate();
  const todayDayOfMonth = today.getDate();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  let isCorrectDay = false;
  if (targetDayOfMonth <= lastDayOfMonth) {
    isCorrectDay = todayDayOfMonth === targetDayOfMonth;
  } else {
    isCorrectDay = todayDayOfMonth === lastDayOfMonth;
  }

  if (!isCorrectDay) {
    return {
      shouldGenerate: false,
      reason: `No es día de generación. Día objetivo: ${targetDayOfMonth}, hoy: ${todayDayOfMonth}`,
      dayOfMonth: targetDayOfMonth,
    };
  }

  const alreadyGenerated = await wasReportGeneratedThisMonth(userId, '360');
  if (alreadyGenerated) {
    return {
      shouldGenerate: false,
      reason: 'Ya se generó un informe 360 este mes',
      dayOfMonth: targetDayOfMonth,
      alreadyGeneratedThisMonth: true,
    };
  }

  return {
    shouldGenerate: true,
    dayOfMonth: targetDayOfMonth,
    alreadyGeneratedThisMonth: false,
  };
}

// ============================================================================
// FUNCIONES PARA ADVERTENCIAS (botones manuales)
// ============================================================================

export async function getReportWarnings(
  userId: string,
  reportType: 'BASIC' | 'DAILY' | 'LABS' | '360'
): Promise<string[]> {
  const warnings: string[] = [];
  const { data: profile } = await supabase.from('profiles').select('subscription_tier').eq('id', userId).single();
  const userTier = profile?.subscription_tier || 'free';

  switch (reportType) {
    case 'BASIC': {
      if (userTier !== 'premium' && userTier !== 'vip') {
        warnings.push('⚠️ El Informe Básico es exclusivo para usuarias Premium.');
      } else {
        const hasAllForms = await hasAllBasicForms(userId);
        if (!hasAllForms) {
          warnings.push('⚠️ Faltan formularios básicos. El informe podría estar incompleto.');
        }
      }
      break;
    }

    case 'DAILY': {
      if (userTier === 'free') {
        const totalReports = await getTotalDailyReports(userId);
        if (totalReports >= 1) {
          warnings.push('⚠️ Ya has generado tu único Informe Diario gratuito. Actualiza a Premium para informes ilimitados.');
        } else {
          const count = await countRecentDailyLogs(userId, 100);
          if (count < 7) {
            warnings.push(`ℹ️ Como usuaria Free, obtendrás 1 informe de regalo al llegar a 7 registros. Llevas ${count}/7.`);
          } else {
            warnings.push('✨ ¡Listo! Haz completado los 7 registros necesarios para tu informe gratuito.');
          }
        }
      } else {
        const logsCount = await countRecentDailyLogs(userId, 15);
        if (logsCount < 7) {
          warnings.push(`⚠️ Solo tienes ${logsCount} registros en los últimos 15 días (recomendado: 7+).`);
        }
        const days = await getDaysSinceMethodStart(userId);
        if (days !== null && days % 15 !== 0) {
          warnings.push(`ℹ️ Normalmente se genera cada 15 días. Llevas ${days} días.`);
        }
      }
      break;
    }

    case '360': {
      if (userTier === 'free') {
        warnings.push('⚠️ El Informe 360 es exclusivo para usuarias Premium.');
      } else {
        const already = await wasReportGeneratedThisMonth(userId, '360');
        if (already) warnings.push('⚠️ Ya generaste un informe 360 este mes.');
      }
      break;
    }

    case 'LABS': {
      if (userTier !== 'premium' && userTier !== 'vip') {
        warnings.push('⚠️ La interpretación de analíticas es exclusiva para usuarias Premium.');
      }
      break;
    }
  }

  return warnings;
}

/**
 * Obtiene todos los usuarios con method_start_date (para cron jobs)
 */
export async function getUsersWithMethodStartDate(): Promise<Array<{ id: string; method_start_date: string }>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, method_start_date')
    .not('method_start_date', 'is', null);

  if (error) {
    logger.error('Error fetching users with method_start_date:', error);
    return [];
  }

  return data || [];
}
