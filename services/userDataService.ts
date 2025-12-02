/**
 * Centralized user data fetching service
 * Single source of truth for all data fetching operations with retry logic
 */

import { DailyLog, ConsultationForm, AppNotification, AdminReport, CourseModule } from '../types';
import { supabase } from './supabase';
import { formatDateForDB } from './dataService';
import { withRetry } from './utils';
import { logger } from '../lib/logger';

// Generic Result type for safe data fetching
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Maps database log format to application log format
 */
export const mapLogFromDB = (dbLog: any): DailyLog => ({
  id: dbLog.id,
  user_id: dbLog.user_id,
  date: dbLog.date,
  cycleDay: dbLog.cycle_day,
  bbt: dbLog.bbt,
  mucus: dbLog.mucus || '',
  cervixHeight: dbLog.cervix_height || '',
  cervixFirmness: dbLog.cervix_firmness || '',
  cervixOpenness: dbLog.cervix_openness || '',
  lhTest: dbLog.lh_test || 'No realizado',
  symptoms: dbLog.symptoms || [],
  sex: dbLog.sex,
  sleepQuality: dbLog.sleep_quality,
  sleepHours: dbLog.sleep_hours,
  stressLevel: dbLog.stress_level,
  activityMinutes: dbLog.activity_minutes || 0,
  sunMinutes: dbLog.sun_minutes || 0,
  waterGlasses: dbLog.water_glasses,
  veggieServings: dbLog.veggie_servings,
  alcohol: dbLog.alcohol
});

/**
 * Fetches user logs with retry logic and exponential backoff
 * @param userId - User ID
 * @param daysLimit - Number of days to fetch (default: 90)
 * @returns Result with DailyLog array or error message
 */
export async function fetchLogsForUser(
  userId: string,
  daysLimit: number = 90
): Promise<Result<DailyLog[]>> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    const cutoffDateStr = formatDateForDB(cutoffDate);

    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', cutoffDateStr)
        .order('date', { ascending: false })
        .limit(daysLimit);
      
      if (result.error) {
        throw result.error;
      }
      return result;
    });

    if (data) {
      return { success: true, data: data.map(mapLogFromDB) };
    }
    return {
      success: false,
      error: 'No pudimos cargar tus registros. Intenta recargar la página.'
    };
  } catch (error) {
    logger.error('❌ Error fetching logs after retries:', error);
    return {
      success: false,
      error: 'No pudimos cargar tus registros. Intenta recargar la página.'
    };
  }
}

/**
 * Fetches all user logs (no date limit)
 * @param userId - User ID
 * @returns Result with DailyLog array or error message
 */
export async function fetchAllLogsForUser(userId: string): Promise<Result<DailyLog[]>> {
  try {
    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      
      if (result.error) {
        throw result.error;
      }
      return result;
    });

    if (data) {
      return { success: true, data: data.map(mapLogFromDB) };
    }
    return {
      success: false,
      error: 'No pudimos cargar tu historial completo. Intenta recargar la página.'
    };
  } catch (error) {
    logger.error('❌ Error fetching all logs after retries:', error);
    return {
      success: false,
      error: 'No pudimos cargar tu historial completo. Intenta recargar la página.'
    };
  }
}

/**
 * Fetches user notifications with retry logic
 * @param userId - User ID
 * @returns Result with notifications (excluding soft-deleted) or error message
 */
export async function fetchNotificationsForUser(userId: string): Promise<Result<AppNotification[]>> {
  try {
    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (result.error) {
        throw result.error;
      }
      return result;
    });

    if (data) {
      // Filter out soft-deleted notifications (metadata.deleted === true)
      const filtered = Array.isArray(data) ? data.filter(n => !n.metadata?.deleted) : [];
      return { success: true, data: filtered };
    }
    return {
      success: false,
      error: 'No pudimos cargar tus notificaciones. Intenta recargar la página.'
    };
  } catch (error) {
    logger.error('❌ Error fetching notifications after retries:', error);
    return {
      success: false,
      error: 'No pudimos cargar tus notificaciones. Intenta recargar la página.'
    };
  }
}

/**
 * Fetches user forms with retry logic
 * @param userId - User ID
 * @returns Result with ConsultationForm array or error message
 */
export async function fetchUserFormsForUser(userId: string): Promise<Result<ConsultationForm[]>> {
  try {
    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from('consultation_forms')
        .select('*')
        .eq('user_id', userId);
      
      if (result.error) {
        throw result.error;
      }
      return result;
    });

    if (data) {
      return { success: true, data };
    }
    return {
      success: false,
      error: 'No pudimos cargar tus formularios. Intenta recargar la página.'
    };
  } catch (error) {
    logger.error('❌ Error fetching forms after retries:', error);
    return {
      success: false,
      error: 'No pudimos cargar tus formularios. Intenta recargar la página.'
    };
  }
}

/**
 * Fetches admin reports for user
 * @param userId - User ID
 * @returns Result with AdminReport array or error message
 */
export async function fetchReportsForUser(userId: string): Promise<Result<AdminReport[]>> {
  try {
    const { data, error } = await supabase
      .from('admin_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      return { success: true, data };
    }
    return {
      success: false,
      error: 'No pudimos cargar tus informes. Intenta recargar la página.'
    };
  } catch (error) {
    logger.error('❌ Error fetching reports:', error);
    return {
      success: false,
      error: 'No pudimos cargar tus informes. Intenta recargar la página.'
    };
  }
}

/**
 * Fetches education content for user
 * @param userId - User ID
 * @param methodStart - Method start date (optional)
 * @returns Result with CourseModule array or error message
 */
export async function fetchEducationForUser(
  userId: string,
  methodStart?: string
): Promise<Result<CourseModule[]>> {
  try {
    const { data: modulesData } = await supabase
      .from('content_modules')
      .select(`*, content_lessons (*)`)
      .order('order_index');

    const { data: progressData } = await supabase
      .from('user_progress')
      .select('lesson_id')
      .eq('user_id', userId);

    const completedSet = new Set(progressData?.map(p => p.lesson_id) || []);

    let currentWeek = 0;
    if (methodStart) {
      const start = new Date(methodStart);
      start.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      currentWeek = Math.ceil(days / 7) || 1;
    }

    if (modulesData && Array.isArray(modulesData)) {
      const mapped = modulesData.map(m => {
        const safeContentLessons = Array.isArray(m.content_lessons) ? m.content_lessons : [];
        const safeCompletedSet = Array.isArray(Array.from(completedSet)) ? completedSet : new Set();
        
        return {
          id: m.id,
          title: m.title,
          description: m.description,
          order_index: m.order_index,
          phase: m.phase as any,
          lessons: safeContentLessons.sort((a: any, b: any) => {
            if (a.type === 'video' && b.type !== 'video') return -1;
            if (a.type !== 'video' && b.type === 'video') return 1;
            return 0;
          }),
          completedLessons: Array.from(safeCompletedSet).filter(id =>
            safeContentLessons.some((l: any) => l.id === id)
          ) as number[],
          isCompleted: false,
          isLocked: m.phase > 0 && (!methodStart || m.order_index > currentWeek)
        };
      });
      return { success: true, data: mapped };
    }
    return {
      success: false,
      error: 'No pudimos cargar tu contenido educativo. Intenta recargar la página.'
    };
  } catch (error) {
    logger.error('❌ Error fetching education:', error);
    return {
      success: false,
      error: 'No pudimos cargar tu contenido educativo. Intenta recargar la página.'
    };
  }
}

/**
 * Database profile type (raw Supabase response)
 */
interface SupabaseProfile {
  id: string;
  email?: string;
  name: string;
  created_at: string;
  method_start_date?: string | null;
  age: number;
  weight: number;
  height: number;
  time_trying_start_date?: string | null; // Date when user started trying (YYYY-MM-DD)
  time_trying_initial_months?: number | null; // Initial months value
  disclaimer_accepted: boolean;
  main_objective?: string | null;
  partner_status?: string | null;
  role?: string | null;
  cycle_regularity?: string | null;
  cycle_length?: number | null;
  last_period_date?: string | null;
  period_history?: string[] | null;
  // Legacy fields (migrated to pillar tables, kept for backward compatibility)
  time_trying?: number | string | null;
  diagnoses?: string[] | null;
  fertility_treatments?: string | null;
  supplements?: string | null;
  alcohol_consumption?: string | null;
  user_type?: string | null;
}

/**
 * Fetches user profile
 * @param userId - User ID
 * @returns User profile object or null
 */
export async function fetchProfileForUser(userId: string): Promise<SupabaseProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Profile doesn't exist
      }
      logger.error('❌ Error fetching profile:', error);
      throw error;
    }

    return data as SupabaseProfile;
  } catch (error) {
    logger.error('❌ Error fetching profile:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Profile mutations (centralized writes to `profiles`)
// -----------------------------------------------------------------------------

type ProfileInsertPayload = {
  id: string;
  email?: string | null;
  name: string;
  age?: number;
  disclaimer_accepted?: boolean;
};

type ProfileUpdatePayload = Partial<{
  name: string;
  age: number;
  weight: number;
  height: number;
  main_objective: string | null;
  partner_status: string | null;
  cycle_regularity: string | null;
  cycle_length: number | null;
  last_period_date: string | null;
  period_history: string[] | null;
  time_trying_start_date: string | null;
  time_trying_initial_months: number | null;
  time_trying: number | string | null;
  diagnoses: string[] | null;
  fertility_treatments: string | null;
  supplements: string | null;
  alcohol_consumption: string | null;
}>;

/**
 * Creates a new profile row in `profiles`
 */
export async function createProfileForUser(payload: ProfileInsertPayload): Promise<void> {
  const { id, email, name, age = 30, disclaimer_accepted = false } = payload;

  const { error } = await supabase.from('profiles').insert({
    id,
    email,
    name,
    age,
    disclaimer_accepted
  });

  if (error) {
    logger.error('❌ Profile creation failed:', error);
    throw error;
  }
}

/**
 * Updates an existing profile row in `profiles`
 */
export async function updateProfileForUser(
  userId: string,
  updates: ProfileUpdatePayload
): Promise<void> {
  if (!userId) return;
  if (!updates || Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    logger.error('❌ Error updating profile:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Consultation form mutations
// -----------------------------------------------------------------------------

type ConsultationFormUpdatePayload = Partial<{
  answers: any;
  status: string;
}>;

export async function updateConsultationFormById(
  formId: number,
  updates: ConsultationFormUpdatePayload
): Promise<void> {
  if (!formId) return;
  if (!updates || Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from('consultation_forms')
    .update(updates)
    .eq('id', formId);

  if (error) {
    logger.error('❌ Error updating consultation form:', error);
    throw error;
  }
}

