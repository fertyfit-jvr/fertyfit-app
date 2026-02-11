import { create } from 'zustand';
import {
  AppNotification,
  ConsultationForm,
  CourseModule,
  DailyLog,
  Lesson,
  UserProfile,
  ViewState
} from '../types';
import { formatDateForDB } from '../services/dataService';
import { DashboardScores, emptyDashboardScores, getDashboardScores } from '../services/dashboardScoreService';
import { supabase } from '../services/supabase';
import {
  fetchAllLogsForUser,
  fetchEducationForUser,
  fetchLogsForUser,
  fetchNotificationsForUser,
  fetchUserFormsForUser
} from '../services/userDataService';
import { logger } from '../lib/logger';
import { getCycleDay } from '../hooks/useCycleDay';
import { DailyLogSchema } from '../types/schemas';
import { evaluateRules } from '../services/RuleEngine';
import { buildRuleContext } from '../services/buildRuleContext';

type ToastState = { msg: string; type: 'success' | 'error' } | null;

type TodayLogState = Partial<DailyLog>;

const buildInitialTodayLog = (): TodayLogState => ({
  date: formatDateForDB(new Date()),
  cycleDay: 1,
  symptoms: [],
  alcohol: false,
  activityMinutes: 0,
  sunMinutes: 0,
  lhTest: 'No realizado'
});

const loadDeletedNotifications = (): number[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('fertyfit_deleted_notifications');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

interface AppStore {
  loading: boolean;
  view: ViewState;
  user: UserProfile | null;
  logs: DailyLog[];
  dashboardScores: DashboardScores;
  notifications: AppNotification[];
  submittedForms: ConsultationForm[];
  email: string;
  password: string;
  name: string;
  isSignUp: boolean;
  authError: string;
  notif: ToastState;
  courseModules: CourseModule[];
  todayLog: TodayLogState;
  activeLesson: Lesson | null;
  deletedNotificationIds: number[];

  setLoading: (loading: boolean) => void;
  setView: (view: ViewState) => void;
  setUser: (user: UserProfile | null) => void;
  setLogs: (logs: DailyLog[]) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  setSubmittedForms: (forms: ConsultationForm[]) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setName: (name: string) => void;
  setIsSignUp: (value: boolean) => void;
  setAuthError: (message: string) => void;
  setNotif: (toast: ToastState) => void;
  setCourseModules: (modules: CourseModule[]) => void;
  setTodayLog: (log: TodayLogState | ((prev: TodayLogState) => TodayLogState)) => void;
  setActiveLesson: (lesson: Lesson | null) => void;
  setDeletedNotificationIds: (ids: number[]) => void;

  // Derived state setters / helpers
  setDashboardScores: (scores: DashboardScores) => void;

  // Business logic helpers (migrated from App.tsx)
  showNotif: (msg: string, type: 'success' | 'error') => void;
  handleRestartMethod: () => Promise<void>;
  fetchLogs: (userId: string, daysLimit?: number) => Promise<DailyLog[]>;
  fetchAllLogs: (userId: string) => Promise<DailyLog[]>;
  fetchNotifications: (userId: string) => Promise<void>;
  fetchUserForms: (userId: string) => Promise<void>;
  fetchEducation: (userId: string, methodStart?: string) => Promise<void>;
  markNotificationRead: (notifId: number) => Promise<void>;
  deleteNotification: (notifId: number) => Promise<void>;
  handleDateChange: (newDate: string) => void;
  saveDailyLog: () => Promise<void>;
  startMethod: () => Promise<void>;
  markLessonComplete: (lessonId: number) => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  loading: true,
  view: 'ONBOARDING',
  user: null,
  logs: [],
  dashboardScores: emptyDashboardScores,
  notifications: [],
  submittedForms: [],
  email: '',
  password: '',
  name: '',
  isSignUp: false,
  authError: '',
  notif: null,
  courseModules: [],
  todayLog: buildInitialTodayLog(),
  activeLesson: null,
  deletedNotificationIds: loadDeletedNotifications(),

  setLoading: (loading) => set({ loading }),
  setView: (view) => set({ view }),
  setUser: (user) => set({ user }),
  setLogs: (logs) => set({ logs }),
  setNotifications: (notifications) => set({ notifications }),
  setSubmittedForms: (forms) => set({ submittedForms: forms }),
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  setName: (name) => set({ name }),
  setIsSignUp: (value) => set({ isSignUp: value }),
  setAuthError: (message) => set({ authError: message }),
  setNotif: (toast) => set({ notif: toast }),
  setCourseModules: (modules) => set({ courseModules: Array.isArray(modules) ? modules : [] }),
  setTodayLog: (log) => set((state) => ({
    todayLog: typeof log === 'function' ? log(state.todayLog) : log
  })),
  setActiveLesson: (lesson) => set({ activeLesson: lesson }),
  setDeletedNotificationIds: (ids) => set({ deletedNotificationIds: ids }),

  setDashboardScores: (scores) => set({ dashboardScores: scores }),

  showNotif: (msg, type) => {
    set({ notif: { msg, type } });
    // Auto-hide después de 4s
    setTimeout(() => {
      // Evitar sobreescribir si ya se cambió desde otro sitio
      if (get().notif?.msg === msg && get().notif?.type === type) {
        set({ notif: null });
      }
    }, 4000);
  },

  handleRestartMethod: async () => {
    const { user, showNotif, setUser } = get();
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ method_start_date: null })
      .eq('id', user.id);
    if (error) {
      showNotif('No se pudo reiniciar el método', 'error');
      return;
    }
    setUser({ ...user, methodStartDate: null });
    showNotif('Método reiniciado correctamente', 'success');
  },

  fetchLogs: async (userId: string, daysLimit: number = 90) => {
    const { user, setLogs, setTodayLog, showNotif, setDashboardScores } = get();
    try {
      const result = await fetchLogsForUser(userId, daysLimit);
      if (!result.success) {
        showNotif((result as any).error, 'error');
        return [];
      }
      const mappedLogs = result.data;
      setLogs(mappedLogs);
      const todayStr = formatDateForDB(new Date());
      const existingToday = mappedLogs.find((l) => l.date === todayStr);

      if (user?.lastPeriodDate && user?.cycleLength) {
        const currentCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);

        if (existingToday) {
          setTodayLog({ ...existingToday, cycleDay: currentCycleDay });
        } else {
          setTodayLog({
            date: todayStr,
            cycleDay: currentCycleDay > 0 ? currentCycleDay : 1,
            symptoms: [],
            alcohol: false,
            lhTest: 'No realizado',
            activityMinutes: 0,
            sunMinutes: 0
          });
        }
      } else if (existingToday) {
        setTodayLog(existingToday);
      } else if (mappedLogs.length > 0) {
        const last = mappedLogs[0];
        const diff = Math.ceil(
          Math.abs(new Date().getTime() - new Date(last.date).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        setTodayLog((p) => ({
          ...p,
          date: todayStr,
          cycleDay: (last.cycleDay + diff) || 1,
          symptoms: [],
          alcohol: false,
          lhTest: 'No realizado',
          activityMinutes: 0,
          sunMinutes: 0
        }));
      }

      if (get().user) {
        try {
          const scores = await getDashboardScores(get().user, mappedLogs);
          setDashboardScores(scores);
        } catch (err) {
          logger.error('❌ Error calculating dashboard scores after fetchLogs:', err);
        }
      }
      return mappedLogs;
    } catch (error) {
      logger.error('❌ Error fetching logs:', error);
      showNotif('Error cargando registros. Intenta recargar la página.', 'error');
      return [];
    }
  },

  fetchAllLogs: async (userId: string) => {
    const { setLogs, showNotif, setDashboardScores } = get();
    try {
      const result = await fetchAllLogsForUser(userId);
      if (!result.success) {
        showNotif((result as any).error, 'error');
        return [];
      }
      const mappedLogs = result.data;
      setLogs(mappedLogs);
      if (get().user) {
        try {
          const scores = await getDashboardScores(get().user, mappedLogs);
          setDashboardScores(scores);
        } catch (err) {
          logger.error('❌ Error calculating dashboard scores after fetchAllLogs:', err);
        }
      }
      return mappedLogs;
    } catch (error) {
      logger.error('❌ Error fetching all logs:', error);
      showNotif('Error cargando historial completo. Intenta recargar la página.', 'error');
      return [];
    }
  },

  fetchNotifications: async (userId: string) => {
    const { setNotifications, showNotif } = get();
    try {
      const result = await fetchNotificationsForUser(userId);
      if (!result.success) {
        showNotif((result as any).error, 'error');
        setNotifications([]);
        return;
      }
      setNotifications(result.data);
    } catch (error) {
      logger.error('❌ Error fetching notifications:', error);
      setNotifications([]);
    }
  },

  fetchUserForms: async (userId: string) => {
    const { setSubmittedForms, showNotif } = get();
    try {
      const result = await fetchUserFormsForUser(userId);
      if (!result.success) {
        showNotif((result as any).error, 'error');
        return;
      }
      setSubmittedForms(result.data);
    } catch (error) {
      logger.error('❌ Error fetching forms:', error);
      showNotif('Error cargando formularios. Intenta recargar la página.', 'error');
    }
  },

  fetchEducation: async (userId: string, methodStart?: string) => {
    const { setCourseModules, showNotif } = get();
    try {
      const result = await fetchEducationForUser(userId, methodStart);
      if (!result.success) {
        showNotif((result as any).error, 'error');
        setCourseModules([]);
        return;
      }
      setCourseModules(result.data);
    } catch (error) {
      logger.error('❌ Error fetching education:', error);
      setCourseModules([]);
    }
  },

  markNotificationRead: async (notifId: number) => {
    const { showNotif, user, fetchNotifications } = get();
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);

      if (error) {
        logger.error('Error marking notification as read:', error);
        showNotif('No pudimos marcar la notificación como leída. Intenta nuevamente.', 'error');
        return;
      }

      // Refrescar desde BD para sincronizar estado local
      if (user?.id) {
        await fetchNotifications(user.id);
      }
    } catch (error) {
      logger.error('Error in markNotificationRead:', error);
      showNotif('Error inesperado al marcar la notificación. Intenta nuevamente.', 'error');
    }
  },

  deleteNotification: async (notifId: number) => {
    const { showNotif, deletedNotificationIds, setDeletedNotificationIds, user, fetchNotifications } = get();
    try {
      const { data: current, error: fetchError } = await supabase
        .from('notifications')
        .select('metadata')
        .eq('id', notifId)
        .single();

      if (fetchError) {
        logger.error('Error fetching notification metadata:', fetchError);
        showNotif('No pudimos eliminar la notificación. Intenta nuevamente.', 'error');
        return;
      }

      const newMeta = { ...(current?.metadata || {}), deleted: true };
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ metadata: newMeta })
        .eq('id', notifId);

      if (updateError) {
        logger.error('Error deleting notification:', updateError);
        showNotif('No pudimos eliminar la notificación. Intenta nuevamente.', 'error');
        return;
      }

      const newDeletedIds = [...deletedNotificationIds, notifId];
      setDeletedNotificationIds(newDeletedIds);
      localStorage.setItem('fertyfit_deleted_notifications', JSON.stringify(newDeletedIds));

      // Refrescar desde BD para sincronizar estado local
      if (user?.id) {
        await fetchNotifications(user.id);
      }

      logger.log('✅ Notification soft-deleted', notifId);
    } catch (error) {
      logger.error('Error in deleteNotification:', error);
      showNotif('Error inesperado al eliminar la notificación. Intenta nuevamente.', 'error');
    }
  },

  handleDateChange: (newDate: string) => {
    const { logs, user, setTodayLog } = get();
    const existingLog = logs.find((l) => l.date === newDate);
    if (existingLog) {
      if (user?.lastPeriodDate && user?.cycleLength) {
        const correctCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
        setTodayLog({
          ...existingLog,
          cycleDay: correctCycleDay > 0 ? correctCycleDay : 1
        });
      } else {
        setTodayLog(existingLog);
      }
    } else {
      let newCycleDay = 1;
      if (user?.lastPeriodDate && user?.cycleLength) {
        newCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
      }
      setTodayLog({
        date: newDate,
        cycleDay: newCycleDay > 0 ? newCycleDay : 1,
        symptoms: [],
        alcohol: false,
        activityMinutes: 0,
        sunMinutes: 0,
        lhTest: 'No realizado'
      });
    }
  },

  saveDailyLog: async () => {
    const { user, logs, courseModules, todayLog, showNotif, fetchLogs, fetchNotifications, setView } = get();
    if (!user?.id) return;

    // Solo obligamos la fecha; el resto de campos son opcionales
    if (!todayLog.date) {
      showNotif('La fecha es obligatoria', 'error');
      return;
    }
    const validDate = formatDateForDB(new Date(todayLog.date)); // normaliza formato

    let correctCycleDay = todayLog.cycleDay || 1;
    if (user.lastPeriodDate && user.cycleLength) {
      correctCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
    }

    // Proporcionar valores por defecto para campos opcionales antes de validar
    const formattedLog = {
      ...todayLog,
      date: validDate,
      cycleDay: correctCycleDay,
      // Solo BBT y mucus son obligatorios, el resto son opcionales
      sleepQuality: todayLog.sleepQuality,
      veggieServings: todayLog.veggieServings,
      activityMinutes: todayLog.activityMinutes,
      sunMinutes: todayLog.sunMinutes,
      waterGlasses: todayLog.waterGlasses,
      alcohol: todayLog.alcohol,
      sex: todayLog.sex,
      symptoms: todayLog.symptoms,
      lhTest: todayLog.lhTest,
      sleepHours: todayLog.sleepHours,
      stressLevel: todayLog.stressLevel,
    };

    // Normalizar valores opcionales para que el schema no falle por undefined
    const normalizedLog = {
      ...formattedLog,
      lhTest: formattedLog.lhTest || 'No realizado',
      symptoms: Array.isArray(formattedLog.symptoms) ? formattedLog.symptoms : [],
      sex: formattedLog.sex ?? false,
      sleepQuality:
        typeof formattedLog.sleepQuality === 'number' && !Number.isNaN(formattedLog.sleepQuality)
          ? formattedLog.sleepQuality
          : undefined,
      sleepHours:
        typeof formattedLog.sleepHours === 'number' && !Number.isNaN(formattedLog.sleepHours)
          ? formattedLog.sleepHours
          : undefined,
      stressLevel:
        typeof formattedLog.stressLevel === 'number' && !Number.isNaN(formattedLog.stressLevel)
          ? formattedLog.stressLevel
          : undefined,
      activityMinutes:
        typeof formattedLog.activityMinutes === 'number' && !Number.isNaN(formattedLog.activityMinutes)
          ? formattedLog.activityMinutes
          : undefined,
      sunMinutes:
        typeof formattedLog.sunMinutes === 'number' && !Number.isNaN(formattedLog.sunMinutes)
          ? formattedLog.sunMinutes
          : undefined,
      waterGlasses:
        typeof formattedLog.waterGlasses === 'number' && !Number.isNaN(formattedLog.waterGlasses)
          ? formattedLog.waterGlasses
          : undefined,
      veggieServings:
        typeof formattedLog.veggieServings === 'number' && !Number.isNaN(formattedLog.veggieServings)
          ? formattedLog.veggieServings
          : undefined,
      alcohol: formattedLog.alcohol ?? false
    };

    // Validar el payload con Zod antes de guardar
    try {
      DailyLogSchema.parse(normalizedLog);
    } catch (validationError: unknown) {
      // Zod usa 'issues', no 'errors'
      let message = 'Algunos valores del registro diario no son válidos. Revisa los campos e inténtalo de nuevo.';

      // Validar que sea un ZodError
      if (validationError && typeof validationError === 'object') {
        // ZodError tiene estructura { issues: Array<{ message: string, path: string[] }> }
        if ('issues' in validationError && Array.isArray(validationError.issues) && validationError.issues.length > 0) {
          const firstIssue = validationError.issues[0];
          if (firstIssue && typeof firstIssue === 'object' && 'message' in firstIssue) {
            message = String(firstIssue.message);

            // Agregar campo específico si está disponible para mejor UX
            if ('path' in firstIssue && Array.isArray(firstIssue.path) && firstIssue.path.length > 0) {
              const fieldName = firstIssue.path[firstIssue.path.length - 1];
              message = `${String(fieldName)}: ${message}`;
            }
          }
        }
      }

      logger.warn('❌ DailyLog validation failed:', {
        error: validationError,
        message,
        normalizedLog: normalizedLog, // Para debugging
      });

      showNotif(message, 'error');
      return;
    }

    const { error } = await supabase
      .from('daily_logs')
      .upsert(
        {
          user_id: user.id,
          date: validDate,
          cycle_day: normalizedLog.cycleDay,
          bbt: normalizedLog.bbt,
          mucus: normalizedLog.mucus,
          cervix_height: normalizedLog.cervixHeight,
          cervix_firmness: normalizedLog.cervixFirmness,
          cervix_openness: normalizedLog.cervixOpenness,
          lh_test: normalizedLog.lhTest,
          symptoms: normalizedLog.symptoms,
          sex: normalizedLog.sex,
          sleep_quality: normalizedLog.sleepQuality,
          sleep_hours: normalizedLog.sleepHours,
          stress_level: normalizedLog.stressLevel,
          water_glasses: normalizedLog.waterGlasses,
          veggie_servings: normalizedLog.veggieServings,
          alcohol: normalizedLog.alcohol,
          activity_minutes: normalizedLog.activityMinutes,
          sun_minutes: normalizedLog.sunMinutes
        },
        { onConflict: 'user_id, date' }
      );

    if (!error) {
      showNotif('Registro guardado con éxito', 'success');

      // Refrescar datos en paralelo para mejor rendimiento
      const [logsResult] = await Promise.allSettled([
        fetchLogs(user.id),
        fetchNotifications(user.id)
      ]);

      // ⭐ TRIGGER: FertyScore calculation (every 3 logs)
      // Check if we should trigger based on logs count
      // We use the updated logs count
      const updatedLogs = logsResult.status === 'fulfilled' ? logsResult.value : logs;

      if (updatedLogs.length > 0 && updatedLogs.length % 3 === 0) {
        // Import dynamically or ensure imports are at top
        // We will assume imports are available or use dynamic import if needed to avoid circle?
        // useAppStore -> pillarService -> fetchAllPillars
        // useAppStore -> fertyscoreService -> calculateAndSaveScore
        try {
          // Dynamic import to avoid potential circular dependency issues at module level
          // if useAppStore is imported by services (unlikely but safer)
          const { fetchAllPillars } = await import('../services/pillarService');
          const { calculateAndSaveScore } = await import('../services/fertyscoreService');
          const { fetchProfileForUser } = await import('../services/userDataService');

          const profile = await fetchProfileForUser(user.id);
          const pillars = await fetchAllPillars(user.id);

          if (profile) {
            await calculateAndSaveScore(user.id, profile as any, updatedLogs, pillars, 'daily_log');
            logger.log('✅ Triggered FertyScore calculation from Daily Log');
          }
        } catch (err) {
          logger.error('Error triggering FertyScore from Daily Log:', err);
        }
      }

      // Trigger DAILY_LOG_SAVED después de guardar
      try {
        const context = await buildRuleContext(user, updatedLogs, courseModules);
        await evaluateRules('DAILY_LOG_SAVED', context, user.id);

        // Refrescar notificaciones después del trigger
        await fetchNotifications(user.id);
      } catch (triggerError) {
        logger.error('Error evaluating DAILY_LOG_SAVED trigger:', triggerError);
        // No fallar el guardado si el trigger falla
      }

      setView('DASHBOARD');
    } else {
      showNotif('Error al guardar: ' + error.message, 'error');
    }
  },

  startMethod: async () => {
    const { user, showNotif, setView, fetchEducation, setUser } = get();
    if (!user?.id) return;

    const startDate = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ method_start_date: startDate })
      .eq('id', user.id);

    if (!error) {
      const updatedUser = { ...user, methodStartDate: startDate };
      setUser(updatedUser);
      showNotif('¡Método Activado! Bienvenida al Día 1.', 'success');
      fetchEducation(user.id, startDate);
    } else {
      showNotif('Error: ' + error.message, 'error');
    }
  },

  markLessonComplete: async (lessonId: number) => {
    const { user, logs, courseModules, setCourseModules, fetchEducation, showNotif, setActiveLesson, fetchNotifications } = get();
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert(
          { user_id: user.id, lesson_id: lessonId },
          { onConflict: 'user_id, lesson_id' }
        );

      if (error) {
        logger.error('Error marking lesson as complete:', error);
        showNotif('No pudimos marcar la lección como completada. Intenta nuevamente.', 'error');
        return;
      }

      const safePrev = Array.isArray(courseModules) ? courseModules : [];
      if (safePrev.length === 0) {
        logger.warn('courseModules is empty, cannot update lesson completion');
        return;
      }

      const updated = safePrev.map((m) => {
        try {
          if (!m || typeof m.id === 'undefined') {
            logger.warn('Invalid module found:', m);
            return m;
          }

          const safeLessons = Array.isArray(m.lessons) ? m.lessons : [];
          const safeCompletedLessons = Array.isArray(m.completedLessons) ? m.completedLessons : [];

          if (safeLessons.some((l) => l.id === lessonId)) {
            // Check if already completed to avoid duplicates
            if (safeCompletedLessons.includes(lessonId)) {
              return m;
            }
            return { ...m, completedLessons: [...safeCompletedLessons, lessonId] };
          }
          return m;
        } catch (err) {
          logger.error('Error updating module:', err);
          return m;
        }
      });

      setCourseModules(updated);

      // Trigger LESSON_COMPLETED después de marcar como completada
      try {
        const updatedModules = get().courseModules;
        const context = await buildRuleContext(user, logs, updatedModules);
        await evaluateRules('LESSON_COMPLETED', context, user.id);

        // Refrescar notificaciones después del trigger
        await fetchNotifications(user.id);
      } catch (triggerError) {
        logger.error('Error evaluating LESSON_COMPLETED trigger:', triggerError);
        // No fallar si el trigger falla
      }

      if (user?.id && user?.methodStartDate) {
        setTimeout(() => {
          fetchEducation(user.id, user.methodStartDate!);
        }, 100);
      }

      showNotif('Lección completada', 'success');
      setActiveLesson(null);
    } catch (error) {
      logger.error('Error in markLessonComplete:', error);
      showNotif('Error inesperado al marcar la lección. Intenta nuevamente.', 'error');
    }
  }
}));

