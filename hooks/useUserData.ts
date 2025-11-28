/**
 * Custom hook for user data fetching
 * Separates data fetching logic from UI components
 */

import { DailyLog, ConsultationForm, AppNotification, AdminReport, CourseModule } from '../types';
import { supabase } from '../services/supabase';
import { formatDateForDB } from '../services/dataService';

/**
 * Maps database log format to application log format
 */
const mapLogFromDB = (dbLog: any): DailyLog => ({
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
 * Hook for fetching user logs
 */
export const useFetchLogs = () => {
  const fetchLogs = async (
    userId: string,
    onSuccess?: (logs: DailyLog[]) => void,
    onError?: (error: string) => void
  ): Promise<DailyLog[]> => {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching logs:', error);
      onError?.('Error cargando registros: ' + error.message);
      return [];
    }

    if (data) {
      const mappedLogs = data.map(mapLogFromDB);
      onSuccess?.(mappedLogs);
      return mappedLogs;
    }

    return [];
  };

  return { fetchLogs };
};

/**
 * Hook for fetching user notifications
 */
export const useFetchNotifications = () => {
  const fetchNotifications = async (
    userId: string,
    onSuccess?: (notifications: AppNotification[]) => void
  ): Promise<AppNotification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return [];
    }

    if (data) {
      // Filter out soft-deleted notifications (metadata.deleted === true)
      const activeNotifications = data.filter(n => !n.metadata?.deleted);
      onSuccess?.(activeNotifications);
      return activeNotifications;
    }

    return [];
  };

  return { fetchNotifications };
};

/**
 * Hook for fetching user forms
 */
export const useFetchUserForms = () => {
  const fetchUserForms = async (
    userId: string,
    onSuccess?: (forms: ConsultationForm[]) => void,
    onError?: (error: string) => void
  ): Promise<ConsultationForm[]> => {
    const { data, error } = await supabase
      .from('consultation_forms')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error fetching forms:', error);
      onError?.('Error cargando formularios: ' + error.message);
      return [];
    }

    if (data) {
      onSuccess?.(data);
      return data;
    }

    return [];
  };

  return { fetchUserForms };
};

/**
 * Hook for fetching admin reports
 */
export const useFetchReports = () => {
  const fetchReports = async (
    userId: string,
    onSuccess?: (reports: AdminReport[]) => void
  ): Promise<AdminReport[]> => {
    const { data, error } = await supabase
      .from('admin_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching reports:', error);
      return [];
    }

    if (data) {
      onSuccess?.(data);
      return data;
    }

    return [];
  };

  return { fetchReports };
};

/**
 * Hook for fetching education content
 */
export const useFetchEducation = () => {
  const fetchEducation = async (
    userId: string,
    methodStart?: string,
    onSuccess?: (modules: CourseModule[]) => void
  ): Promise<CourseModule[]> => {
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

    if (modulesData) {
      const modules: CourseModule[] = modulesData.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        order_index: m.order_index,
        phase: m.phase as any,
        lessons: m.content_lessons?.sort((a: any, b: any) => {
          if (a.type === 'video' && b.type !== 'video') return -1;
          if (a.type !== 'video' && b.type === 'video') return 1;
          return 0;
        }) || [],
        completedLessons: Array.from(completedSet).filter(id =>
          m.content_lessons?.some((l: any) => l.id === id)
        ) as number[],
        isCompleted: false,
        isLocked: m.phase > 0 && (!methodStart || m.order_index > currentWeek)
      }));

      onSuccess?.(modules);
      return modules;
    }

    return [];
  };

  return { fetchEducation };
};

/**
 * Helper function to initialize today's log from existing logs
 */
export const initializeTodayLog = (
  logs: DailyLog[],
  setTodayLog: (log: Partial<DailyLog>) => void
) => {
  const todayStr = formatDateForDB(new Date());
  const existingToday = logs.find(l => l.date === todayStr);

  if (existingToday) {
    setTodayLog(existingToday);
  } else if (logs.length > 0) {
    const last = logs[0];
    const diff = Math.ceil(
      Math.abs(new Date().getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    setTodayLog({
      date: todayStr,
      cycleDay: (last.cycleDay + diff) || 1,
      symptoms: [],
      alcohol: false,
      lhTest: 'No realizado',
      activityMinutes: 0,
      sunMinutes: 0
    });
  }
};

