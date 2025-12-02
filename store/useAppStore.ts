import { create } from 'zustand';
import {
  AdminReport,
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
  fetchReportsForUser,
  fetchUserFormsForUser
} from '../services/userDataService';
import { logger } from '../lib/logger';
import { getCycleDay } from '../hooks/useCycleDay';

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
  reports: AdminReport[];
  showPhaseModal: boolean;
  currentPhase: number;
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
  setReports: (reports: AdminReport[]) => void;
  setShowPhaseModal: (open: boolean) => void;
  setCurrentPhase: (phase: number) => void;
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
  fetchReports: (userId: string) => Promise<void>;
  fetchUserForms: (userId: string) => Promise<void>;
  fetchEducation: (userId: string, methodStart?: string) => Promise<void>;
  markNotificationRead: (notifId: number) => Promise<void>;
  deleteNotification: (notifId: number) => Promise<void>;
  handleModalClose: (dontShowAgain: boolean) => void;
  handleDateChange: (newDate: string) => void;
  saveDailyLog: () => Promise<void>;
  startMethod: () => Promise<void>;
  acceptDisclaimer: () => Promise<void>;
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
  reports: [],
  showPhaseModal: false,
  currentPhase: 0,
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
  setReports: (reports) => set({ reports }),
  setShowPhaseModal: (open) => set({ showPhaseModal: open }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
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
        showNotif(result.error, 'error');
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
        showNotif(result.error, 'error');
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
        showNotif(result.error, 'error');
        setNotifications([]);
        return;
      }
      setNotifications(result.data);
    } catch (error) {
      logger.error('❌ Error fetching notifications:', error);
      setNotifications([]);
    }
  },

  fetchReports: async (userId: string) => {
    const { setReports, showNotif } = get();
    try {
      const result = await fetchReportsForUser(userId);
      if (!result.success) {
        showNotif(result.error, 'error');
        return;
      }
      setReports(result.data);
    } catch (error) {
      logger.error('❌ Error fetching reports:', error);
    }
  },

  fetchUserForms: async (userId: string) => {
    const { setSubmittedForms, showNotif } = get();
    try {
      const result = await fetchUserFormsForUser(userId);
      if (!result.success) {
        showNotif(result.error, 'error');
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
        showNotif(result.error, 'error');
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
    const { showNotif, setNotifications } = get();
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

      setNotifications((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n));
      });
    } catch (error) {
      logger.error('Error in markNotificationRead:', error);
      showNotif('Error inesperado al marcar la notificación. Intenta nuevamente.', 'error');
    }
  },

  deleteNotification: async (notifId: number) => {
    const { showNotif, deletedNotificationIds, setDeletedNotificationIds, setNotifications } = get();
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

      setNotifications((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.filter((n) => n.id !== notifId);
      });

      logger.log('✅ Notification soft-deleted', notifId);
    } catch (error) {
      logger.error('Error in deleteNotification:', error);
      showNotif('Error inesperado al eliminar la notificación. Intenta nuevamente.', 'error');
    }
  },

  handleModalClose: (dontShowAgain: boolean) => {
    const { user, currentPhase, setShowPhaseModal } = get();
    if (user?.id && dontShowAgain) {
      localStorage.setItem(
        'fertyfit_phase_seen_' + user.id + '_' + currentPhase,
        'true'
      );
    }
    setShowPhaseModal(false);
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
    const { user, todayLog, showNotif, fetchLogs, fetchNotifications, setView } = get();
    if (!user?.id) return;
    if (!todayLog.date) { showNotif('La fecha es obligatoria', 'error'); return; }
    if (!todayLog.bbt) { showNotif('La temperatura (BBT) es obligatoria', 'error'); return; }
    if (!todayLog.mucus) { showNotif('El registro de moco cervical es obligatorio', 'error'); return; }
    if (!todayLog.stressLevel) { showNotif('El nivel de estrés es obligatorio', 'error'); return; }
    if (todayLog.sleepHours === undefined || todayLog.sleepHours === null) {
      showNotif('Las horas de sueño son obligatorias', 'error'); return;
    }
    const validDate = formatDateForDB(new Date(todayLog.date)); // normaliza formato

    let correctCycleDay = todayLog.cycleDay || 1;
    if (user.lastPeriodDate && user.cycleLength) {
      correctCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
    }

    const formattedLog = { ...todayLog, date: validDate, cycleDay: correctCycleDay };

    const { error } = await supabase
      .from('daily_logs')
      .upsert(
        {
          user_id: user.id,
          date: validDate,
          cycle_day: formattedLog.cycleDay,
          bbt: formattedLog.bbt,
          mucus: formattedLog.mucus,
          cervix_height: formattedLog.cervixHeight,
          cervix_firmness: formattedLog.cervixFirmness,
          cervix_openness: formattedLog.cervixOpenness,
          lh_test: formattedLog.lhTest,
          symptoms: formattedLog.symptoms,
          sex: formattedLog.sex,
          sleep_quality: formattedLog.sleepQuality,
          sleep_hours: formattedLog.sleepHours,
          stress_level: formattedLog.stressLevel,
          water_glasses: formattedLog.waterGlasses,
          veggie_servings: formattedLog.veggieServings,
          alcohol: formattedLog.alcohol,
          activity_minutes: formattedLog.activityMinutes,
          sun_minutes: formattedLog.sunMinutes
        },
        { onConflict: 'user_id, date' }
      );

    if (!error) {
      showNotif('Registro guardado con éxito', 'success');
      await fetchLogs(user.id);
      await fetchNotifications(user.id);
      setView('DASHBOARD');
    } else {
      showNotif('Error al guardar: ' + error.message, 'error');
    }
  },

  startMethod: async () => {
    const { user, submittedForms, showNotif, setView, fetchEducation, setUser, setCurrentPhase, setShowPhaseModal } = get();
    if (!user?.id) return;

    const hasF0 = submittedForms.some((f) => f.form_type === 'F0');
    if (!hasF0) {
      showNotif('Debes completar el formulario F0 antes de iniciar el método.', 'error');
      setView('CONSULTATIONS');
      return;
    }

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
      setCurrentPhase(1);
      setShowPhaseModal(true);
    } else {
      showNotif('Error: ' + error.message, 'error');
    }
  },

  acceptDisclaimer: async () => {
    const { user, setUser, setView } = get();
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ disclaimer_accepted: true })
      .eq('id', user.id);
    if (!error) {
      setUser({ ...user, disclaimerAccepted: true });
      setView('DASHBOARD');
    }
  },

  markLessonComplete: async (lessonId: number) => {
    const { user, setCourseModules, fetchEducation, showNotif, setActiveLesson } = get();
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

      setCourseModules((prev) => {
        try {
          const safePrev = Array.isArray(prev) ? prev : [];
          if (safePrev.length === 0) {
            logger.warn('courseModules is empty, cannot update lesson completion');
            return safePrev;
          }

          const updated = safePrev.map((m) => {
            try {
              if (!m || typeof m.id === 'undefined') {
                logger.warn('Invalid module found:', m);
                return m;
              }

              const safeLessons = Array.isArray(m.lessons) ? m.lessons : [];
              const safeCompletedLessons = Array.isArray(m.completedLessons) ? m.completedLessons : [];
              const hasLesson = safeLessons.some((l) => l && l.id === lessonId);

              return {
                ...m,
                lessons: safeLessons,
                completedLessons:
                  hasLesson && !safeCompletedLessons.includes(lessonId)
                    ? [...safeCompletedLessons, lessonId]
                    : safeCompletedLessons
              };
            } catch (err) {
              logger.error('Error updating module:', err, m);
              return m;
            }
          });

          logger.log('Updated courseModules after marking lesson complete:', updated.length, 'modules');
          return updated;
        } catch (err) {
          logger.error('Error in setCourseModules:', err);
          return prev;
        }
      });

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

