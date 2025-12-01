/**
 * Centralized user data fetching service
 * Single source of truth for all data fetching operations with retry logic
 */

import { DailyLog, ConsultationForm, AppNotification, AdminReport, CourseModule } from '../types';
import { supabase } from './supabase';
import { formatDateForDB } from './dataService';
import { withRetry } from './utils';
import { logger } from '../lib/logger';

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
 * @returns Array of DailyLog objects
 */
export async function fetchLogsForUser(
  userId: string,
  daysLimit: number = 90
): Promise<DailyLog[]> {
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
      return data.map(mapLogFromDB);
    }
    return [];
  } catch (error) {
    logger.error('❌ Error fetching logs after retries:', error);
    throw error;
  }
}

/**
 * Fetches all user logs (no date limit)
 * @param userId - User ID
 * @returns Array of DailyLog objects
 */
export async function fetchAllLogsForUser(userId: string): Promise<DailyLog[]> {
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
      return data.map(mapLogFromDB);
    }
    return [];
  } catch (error) {
    logger.error('❌ Error fetching all logs after retries:', error);
    throw error;
  }
}

/**
 * Fetches user notifications with retry logic
 * @param userId - User ID
 * @returns Array of AppNotification objects (excluding soft-deleted)
 */
export async function fetchNotificationsForUser(userId: string): Promise<AppNotification[]> {
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

    if (error) {
      logger.error('❌ Error fetching notifications:', error);
      return [];
    }

    if (data) {
      // Filter out soft-deleted notifications (metadata.deleted === true)
      return Array.isArray(data) ? data.filter(n => !n.metadata?.deleted) : [];
    }
    return [];
  } catch (error) {
    logger.error('❌ Error fetching notifications after retries:', error);
    return [];
  }
}

/**
 * Fetches user forms with retry logic
 * @param userId - User ID
 * @returns Array of ConsultationForm objects
 */
export async function fetchUserFormsForUser(userId: string): Promise<ConsultationForm[]> {
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
      return data;
    }
    return [];
  } catch (error) {
    logger.error('❌ Error fetching forms after retries:', error);
    throw error;
  }
}

/**
 * Fetches admin reports for user
 * @param userId - User ID
 * @returns Array of AdminReport objects
 */
export async function fetchReportsForUser(userId: string): Promise<AdminReport[]> {
  try {
    const { data, error } = await supabase
      .from('admin_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('❌ Error fetching reports:', error);
      return [];
    }

    if (data) {
      return data;
    }
    return [];
  } catch (error) {
    logger.error('❌ Error fetching reports:', error);
    return [];
  }
}

/**
 * Fetches education content for user
 * @param userId - User ID
 * @param methodStart - Method start date (optional)
 * @returns Array of CourseModule objects
 */
export async function fetchEducationForUser(
  userId: string,
  methodStart?: string
): Promise<CourseModule[]> {
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
      return modulesData.map(m => {
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
    }
    return [];
  } catch (error) {
    logger.error('❌ Error fetching education:', error);
    return [];
  }
}

/**
 * Fetches user profile
 * @param userId - User ID
 * @returns User profile object or null
 */
export async function fetchProfileForUser(userId: string): Promise<any | null> {
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

    return data;
  } catch (error) {
    logger.error('❌ Error fetching profile:', error);
    throw error;
  }
}

