/**
 * Centralized user data fetching service
 * Single source of truth for all data fetching operations with retry logic
 */

import { DailyLog, ConsultationForm, AppNotification, CourseModule } from '../types';
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
  email?: string | null;
  name?: string | null;
  created_at: string;
  method_start_date?: string | null;
  age?: number | null;
  birth_date?: string | null; // Date of birth (YYYY-MM-DD)
  weight?: number | null;
  height?: number | null;
  
  // Time trying fields
  time_trying_start_date?: string | null; // Date when user started trying (YYYY-MM-DD)
  time_trying_initial_months?: number | null; // Initial months value
  
  // Basic profile fields from F0
  main_objective?: string | null;
  partner_status?: string | null;
  family_history?: string | null; // q21_family_history from F0
  obstetric_history?: string | null;
  surgical_history?: string | null;
  fertility_treatments?: string | null; // q20_fertility_treatments from F0
  diagnoses?: string | null; // q9_diagnoses from F0 (TEXT, not array)
  
  // User role and type
  role?: string | null;
  user_type?: string | null; // 'free' | 'subscriber'
  
  // Cycle tracking fields
  cycle_regularity?: string | null;
  cycle_length?: number | null;
  last_period_date?: string | null;
  period_history?: string[] | null; // JSONB array
  
  // Consent fields
  consent_personal_data?: boolean | null;
  consent_food?: boolean | null;
  consent_flora?: boolean | null;
  consent_flow?: boolean | null;
  consent_function?: boolean | null;
  consent_daily_log?: boolean | null;
  consent_no_diagnosis?: boolean | null;
  consents_at?: string | null;
}

/**
 * Creates a notification for a user
 * @param notification - Notification data to insert
 * @returns Result with created notification or error
 */
export async function createNotificationForUser(
  notification: Omit<AppNotification, 'id' | 'created_at' | 'is_read'>
): Promise<Result<AppNotification>> {
  try {
    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from('notifications')
        .insert({
          user_id: notification.user_id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority,
          metadata: notification.metadata
        })
        .select()
        .single();

      if (result.error) {
        // Ignorar error de duplicados (23505) - Idempotencia
        if (result.error.code === '23505') {
          logger.log('Duplicate notification prevented by DB constraint (idempotent success).');
          // Retornamos success true pero sin data nueva (o simulamos la data si fuera crítico)
          return { data: { id: -1, ...notification, created_at: new Date().toISOString(), is_read: false } as AppNotification, error: null };
        }
        throw result.error;
      }
      return result;
    });

    if (error) {
      // Doble chequeo por si el error subió
      if (error.code === '23505') {
        return { success: true, data: { id: -1, ...notification, created_at: new Date().toISOString(), is_read: false } as AppNotification };
      }
      logger.error('❌ Notification creation failed:', error);
      return {
        success: false,
        error: 'No pudimos crear la notificación.'
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No pudimos crear la notificación.'
      };
    }

    return {
      success: true,
      data: {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority,
        metadata: data.metadata,
        created_at: data.created_at,
        is_read: data.is_read || false
      }
    };
  } catch (error: any) {
    if (error?.code === '23505') {
      return { success: true, data: { id: -1, ...notification, created_at: new Date().toISOString(), is_read: false } as AppNotification };
    }
    logger.error('❌ Error creating notification after retries:', error);
    return {
      success: false,
      error: 'No pudimos crear la notificación.'
    };
  }
}

/**
 * Creates multiple notifications for a user (with daily limit check)
 * @param userId - User ID
 * @param notifications - Array of notifications to create
 * @returns Result with count of notifications created
 */
export async function createNotificationsForUser(
  userId: string,
  notifications: Omit<AppNotification, 'id' | 'created_at' | 'is_read'>[]
): Promise<Result<number>> {
  if (notifications.length === 0) {
    return { success: true, data: 0 };
  }

  try {
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
      return { success: true, data: 0 };
    }

    const toInsert = notifications.slice(0, remaining);
    let successCount = 0;

    for (const n of toInsert) {
      const result = await createNotificationForUser(n);
      if (result.success) {
        successCount++;
      } else {
        logger.warn('Failed to create notification:', result.error);
      }
    }

    return { success: true, data: successCount };
  } catch (error) {
    logger.error('❌ Error creating notifications:', error);
    return {
      success: false,
      error: 'No pudimos crear las notificaciones.'
    };
  }
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
  birth_date?: string;
};

type ProfileUpdatePayload = Partial<{
  name: string;
  age: number;
  birth_date: string | null;
  weight: number;
  height: number;
  main_objective: string | null;
  partner_status: string | null;
  family_history: string | null;
  obstetric_history: string | null;
  surgical_history: string | null;
  fertility_treatments: string | null;
  diagnoses: string | null; // TEXT field, not array
  cycle_regularity: string | null;
  cycle_length: number | null;
  last_period_date: string | null;
  period_history: string[] | null;
  time_trying_start_date: string | null;
  time_trying_initial_months: number | null;
}>;

/**
 * Creates a new profile row in `profiles`
 * @param payload - Profile data to insert
 * @returns Result indicating success or error
 */
export async function createProfileForUser(payload: ProfileInsertPayload): Promise<Result<void>> {
  const { id, email, name, age, birth_date } = payload;

  try {
    const { error } = await withRetry(async () => {
      const insertData: any = {
        id,
        email,
        name
      };
      
      // Solo incluir age si se proporciona explícitamente
      if (age !== undefined) {
        insertData.age = age;
      }
      
      // Solo incluir birth_date si se proporciona
      if (birth_date !== undefined) {
        insertData.birth_date = birth_date;
      }

      const result = await supabase.from('profiles').insert(insertData);

      if (result.error) {
        throw result.error;
      }
      return result;
    });

    if (error) {
      logger.error('❌ Profile creation failed:', error);
      return {
        success: false,
        error: 'No pudimos crear tu perfil. Por favor, intenta nuevamente.'
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    logger.error('❌ Error creating profile after retries:', error);
    return {
      success: false,
      error: 'No pudimos crear tu perfil. Por favor, intenta nuevamente.'
    };
  }
}

/**
 * Updates an existing profile row in `profiles`
 * @param userId - User ID
 * @param updates - Profile fields to update
 * @returns Result indicating success or error
 */
export async function updateProfileForUser(
  userId: string,
  updates: ProfileUpdatePayload
): Promise<Result<void>> {
  if (!userId) {
    return {
      success: false,
      error: 'ID de usuario requerido.'
    };
  }
  if (!updates || Object.keys(updates).length === 0) {
    return { success: true, data: undefined };
  }

  try {
    const { error } = await withRetry(async () => {
      const result = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (result.error) {
        throw result.error;
      }
      return result;
    });

    if (error) {
      logger.error('❌ Error updating profile:', error);
      return {
        success: false,
        error: 'No pudimos actualizar tu perfil. Por favor, intenta nuevamente.'
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    logger.error('❌ Error updating profile after retries:', error);
    return {
      success: false,
      error: 'No pudimos actualizar tu perfil. Por favor, intenta nuevamente.'
    };
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

