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
 * - Usuarios Free: Máximo 1 informe en total (histórico)
 * - Usuarios Premium/VIP: Sin límite (se genera al actualizar formularios)
 * 
 * Esta función evalúa si es posible generar el informe. La detección de actualizaciones recientes se hace en el cliente.
 */
export async function canGenerateBasic(userId: string): Promise<ReportValidationResult> {
  logger.log(`[BASIC] Checking rules for user ${userId}`);

  // 0. Obtener el tier del usuario
  let userTier = 'free';
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', userId)
    .single();

  if (profile?.user_type) {
    userTier = profile.user_type;
  }

  // 1. Verificar que existan todos los formularios
  const hasAllForms = await hasAllBasicForms(userId);
  if (!hasAllForms) {
    return {
      canGenerate: false,
      reason: 'Faltan formularios básicos. Necesitas completar F0 y los 4 pilares (Function, Food, Flora, Flow).',
    };
  }

  // 2. Verificar límite según el tier (Free = 1 total, Premium/VIP = sin límite)
  if (userTier === 'free') {
    const totalReports = await getTotalBasicReports(userId);
    if (totalReports >= 1) {
      return {
        canGenerate: false,
        reason: 'Límite alcanzado: Las usuarias Free solo pueden generar 1 Informe Básico. Actualiza a Premium para generar informes ilimitados al actualizar tus datos.',
      };
    }
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
 * - Cada 15 días desde method_start_date
 * - Al menos 7 registros en daily_logs de los últimos 15 días
 */
export async function shouldGenerateDaily(userId: string): Promise<DailyReportCheck> {
  logger.log(`[DAILY] Checking rules for user ${userId}`);

  // 1. Verificar que exista method_start_date
  const daysSinceMethodStart = await getDaysSinceMethodStart(userId);
  if (daysSinceMethodStart === null) {
    return {
      shouldGenerate: false,
      reason: 'Usuario no tiene method_start_date configurado',
    };
  }

  // 2. Verificar si es día de generación (múltiplo de 15)
  if (daysSinceMethodStart % 15 !== 0) {
    return {
      shouldGenerate: false,
      reason: `No es día de generación. Días desde inicio: ${daysSinceMethodStart}. Próximo informe en ${15 - (daysSinceMethodStart % 15)} días.`,
      daysSinceMethodStart,
    };
  }

  // 3. Verificar que haya al menos 7 registros en los últimos 15 días
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
 * 
 * Reglas:
 * - Siempre se genera al subir nueva analítica
 * - Sin restricciones adicionales
 */
export async function shouldGenerateLabs(userId: string, examId?: number): Promise<boolean> {
  logger.log(`[LABS] Checking rules for user ${userId}, exam ${examId}`);
  // Sin restricciones por ahora - siempre generar
  return true;
}

/**
 * INFORME 360
 * 
 * Reglas:
 * - Mensual, el mismo día del mes que method_start_date
 * - Si el día no existe (ej: 31 en febrero), usar último día del mes
 * - No generar más de 1 por mes
 */
export async function shouldGenerate360(userId: string): Promise<Report360Check> {
  logger.log(`[360] Checking rules for user ${userId}`);

  // 0. Comprobar tier de usuario (Free no tiene 360)
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', userId)
    .single();

  if (profile?.user_type === 'free') {
    return {
      shouldGenerate: false,
      reason: 'Funcionalidad exclusiva para Premium/VIP',
    };
  }

  // 1. Obtener method_start_date
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

  // 2. Determinar si hoy es el día correcto
  let isCorrectDay = false;

  if (targetDayOfMonth <= lastDayOfMonth) {
    // El día existe en este mes
    isCorrectDay = todayDayOfMonth === targetDayOfMonth;
  } else {
    // El día no existe (ej: 31 en febrero), usar último día del mes
    isCorrectDay = todayDayOfMonth === lastDayOfMonth;
  }

  if (!isCorrectDay) {
    return {
      shouldGenerate: false,
      reason: `No es día de generación. Día objetivo: ${targetDayOfMonth}, hoy: ${todayDayOfMonth}`,
      dayOfMonth: targetDayOfMonth,
    };
  }

  // 3. Verificar que no se haya generado ya este mes
  const alreadyGenerated = await wasReportGeneratedThisMonth(userId, '360');
  if (alreadyGenerated) {
    return {
      shouldGenerate: false,
      reason: 'Ya se generó un informe 360 este mes',
      dayOfMonth: targetDayOfMonth,
      alreadyGeneratedThisMonth: true,
    };
  }

  logger.log(`[360] ✅ Should generate. Target day: ${targetDayOfMonth}, today: ${todayDayOfMonth}`);
  return {
    shouldGenerate: true,
    dayOfMonth: targetDayOfMonth,
    alreadyGeneratedThisMonth: false,
  };
}

// ============================================================================
// FUNCIONES PARA ADVERTENCIAS (botones manuales)
// ============================================================================

/**
 * Genera advertencias para generación manual (no bloquea, solo informa)
 */
export async function getReportWarnings(
  userId: string,
  reportType: 'BASIC' | 'DAILY' | 'LABS' | '360'
): Promise<string[]> {
  const warnings: string[] = [];

  switch (reportType) {
    case 'BASIC': {
      let userTier = 'free';
      const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', userId).single();
      if (profile?.user_type) userTier = profile.user_type;

      const hasAllForms = await hasAllBasicForms(userId);
      if (!hasAllForms) {
        warnings.push('⚠️ Faltan algunos formularios básicos. El informe podría estar incompleto.');
      }

      if (userTier === 'free') {
        const totalReports = await getTotalBasicReports(userId);
        if (totalReports >= 1) {
          warnings.push('⚠️ Has alcanzado el límite de 1 Informe Básico para cuentas gratuitas. Cambia a Premium para generar más informes.');
        } else {
          warnings.push('ℹ️ Como usuaria Free, este será tu único Informe Básico gratuito.');
        }
      }
      break;
    }

    case 'DAILY': {
      const logsCount = await countRecentDailyLogs(userId, 15);
      if (logsCount < 7) {
        warnings.push(`⚠️ Solo tienes ${logsCount} registros diarios en los últimos 15 días (recomendado: 7+).`);
      }

      const daysSinceMethodStart = await getDaysSinceMethodStart(userId);
      if (daysSinceMethodStart === null) {
        warnings.push('⚠️ No tienes configurada la fecha de inicio del método.');
      } else if (daysSinceMethodStart % 15 !== 0) {
        warnings.push(
          `ℹ️ Normalmente se genera cada 15 días. Llevas ${daysSinceMethodStart} días desde el inicio.`
        );
      }
      break;
    }

    case '360': {
      // Si es usuaria free, el 360 es invisible, sin advertencias
      let userTier = 'free';
      const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', userId).single();
      if (profile?.user_type) userTier = profile.user_type;

      if (userTier === 'free') {
        break;
      }

      const alreadyGenerated = await wasReportGeneratedThisMonth(userId, '360');
      if (alreadyGenerated) {
        warnings.push('⚠️ Ya generaste un informe 360 este mes. Los informes 360 son mensuales.');
      }

      const methodStartDate = await getMethodStartDate(userId);
      if (!methodStartDate) {
        warnings.push('⚠️ No tienes configurada la fecha de inicio del método.');
      }
      break;
    }

    case 'LABS': {
      // Sin advertencias por ahora
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
