import React, { Component, useState, useEffect, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import {
  Heart, Activity, BookOpen, FileText, User, AlertCircle,
  Moon, Sun, PlayCircle, FileText as PdfIcon,
  Lock, X, Star, Mail, Key, CheckSquare, Download, ChevronDown, ChevronUp, ArrowRight, Smile, Play,
  CheckCircle, WineOff, Calendar, Thermometer, Droplets, Zap, Clock, Scale, Minus, Sparkles, Trash
} from 'lucide-react';

import { UserProfile, DailyLog, ViewState, CourseModule, MucusType, AdminReport, DailyLog as DailyLogType, ConsultationForm, LHResult, Lesson, AppNotification, NotificationAction } from './types';
import { MedicalReport } from './components/MedicalReport';
import { SYMPTOM_OPTIONS, MUCUS_OPTIONS, CERVIX_HEIGHT_OPTIONS, CERVIX_FIRM_OPTIONS, CERVIX_OPEN_OPTIONS, BRAND_ASSETS, LH_OPTIONS } from './constants';
import { FORM_DEFINITIONS } from './constants/formDefinitions';
import { calculateAverages, calculateAlcoholFreeStreak, getLastLogDetails, formatDateForDB, calculateBMI, calculateVitalityStats, getBMIStatus, calculateDaysOnMethod, calculateCurrentWeek } from './services/dataService';
import { calculateFertyScore } from './services/fertyscoreService';
import { supabase } from './services/supabase';
import { calcularDiaDelCiclo, handlePeriodConfirmed, handlePeriodDelayed } from './services/RuleEngine';
import { getCycleDay } from './hooks/useCycleDay';
import { isValidNotificationHandler } from './types';
import { generarDatosInformeMedico } from './services/MedicalReportHelpers';
import { generateF0Notification, generateLogAnalysis } from './services/googleCloud/geminiService';
import { useAppStore } from './store/useAppStore';
import Notification from './components/common/Notification';
import LogHistoryItem from './components/common/LogHistoryItem';
import PhaseIntroModal from './components/common/PhaseIntroModal';
import NavButton from './components/common/NavButton';
import StatCard from './components/common/StatCard';
import { useAuth } from './hooks/useAuth';
import { useDailyNotifications } from './hooks/useDailyNotifications';
import {
  fetchLogsForUser,
  fetchAllLogsForUser,
  fetchNotificationsForUser,
  fetchUserFormsForUser,
  fetchReportsForUser,
  fetchEducationForUser,
  mapLogFromDB
} from './services/userDataService';
import { logger } from './lib/logger';
import { EXTERNAL_URLS } from './constants/api';

// Lazy load views for better performance
const TrackerView = lazy(() => import('./views/Tracker/TrackerView'));
const DashboardView = lazy(() => import('./views/Dashboard/DashboardView'));
const EducationView = lazy(() => import('./views/Education/EducationView'));
const ConsultationsView = lazy(() => import('./views/Consultations/ConsultationsView'));
const ProfileView = lazy(() => import('./views/Profile/ProfileView'));

// Simple loading component for Suspense fallback
const ViewLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-[#C7958E] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-[#5D7180]">Cargando...</p>
    </div>
  </div>
);

// --- Error Boundary for Production Safety ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    logger.error("App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F0ED] p-6 text-center font-sans">
          <h1 className="text-2xl font-bold text-[#95706B] mb-4">Algo salió mal</h1>
          <p className="text-[#5D7180] mb-6">Lo sentimos. Ha ocurrido un error inesperado.</p>
          <button
            onClick={() => window.location.href = EXTERNAL_URLS.FERTYFIT_HOME}
            className="bg-[#C7958E] text-white px-6 py-3 rounded-full font-bold shadow-lg"
          >
            Volver a FertyFit.com
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


// --- Helpers ---
// mapLogFromDB is now in services/userDataService.ts

const mapLogToDB = (log: DailyLog, userId: string) => ({
  user_id: userId,
  date: formatDateForDB(log.date), // Force valid format
  cycle_day: log.cycleDay,
  bbt: log.bbt,
  mucus: log.mucus,
  cervix_height: log.cervixHeight,
  cervix_firmness: log.cervixFirmness,
  cervix_openness: log.cervixOpenness,
  lh_test: log.lhTest,
  symptoms: log.symptoms,
  sex: log.sex,
  sleep_quality: log.sleepQuality,
  sleep_hours: log.sleepHours,
  stress_level: log.stressLevel,
  water_glasses: log.waterGlasses,
  veggie_servings: log.veggieServings,
  alcohol: log.alcohol,
  activity_minutes: log.activityMinutes,
  sun_minutes: log.sunMinutes
});

// Convert standard YouTube URLs to Embed URLs
const getEmbedUrl = (url: string) => {
  if (!url) return '';
  let embedUrl = url;

  if (url.includes('watch?v=')) {
    const v = url.split('v=')[1]?.split('&')[0];
    embedUrl = `https://www.youtube.com/embed/${v}`;
  } else if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    embedUrl = `https://www.youtube.com/embed/${id}`;
  } else if (url.includes('drive.google.com')) {
    // Convert view/sharing links to preview
    // Ex: https://drive.google.com/file/d/VIDEO_ID/view?usp=sharing -> https://drive.google.com/file/d/VIDEO_ID/preview
    const parts = url.split('/');
    const dIndex = parts.indexOf('d');
    if (dIndex !== -1 && parts[dIndex + 1]) {
      embedUrl = `https://drive.google.com/file/d/${parts[dIndex + 1]}/preview`;
    }
  } else if (url.includes('vimeo.com')) {
    // Ex: https://vimeo.com/VIDEO_ID -> https://player.vimeo.com/video/VIDEO_ID
    const id = url.split('vimeo.com/')[1]?.split('?')[0];
    if (id && !url.includes('player.vimeo.com')) {
      embedUrl = `https://player.vimeo.com/video/${id}`;
    }
  }

  return embedUrl;
};

// calculateFertyScore and calculateStandardDeviation are now in services/fertyscoreService





// --- Components ---

// --- Main App ---

function AppContent() {
  const {
    loading, setLoading,
    view, setView,
    user, setUser,
    logs, setLogs,
    notifications, setNotifications,
    submittedForms, setSubmittedForms,
    reports, setReports,
    showPhaseModal, setShowPhaseModal,
    currentPhase, setCurrentPhase,
    email, setEmail,
    password, setPassword,
    name, setName,
    isSignUp, setIsSignUp,
    authError, setAuthError,
    notif, setNotif,
    courseModules, setCourseModules,
    todayLog, setTodayLog,
    activeLesson, setActiveLesson,
    deletedNotificationIds, setDeletedNotificationIds
  } = useAppStore();

  // Initialize hooks for auth and daily notifications
  const { checkUser, handleAuth: authHandleAuth, handleLogout, refreshUserProfile } = useAuth();
  useDailyNotifications();

  // Filter notifications based on blacklist
  // Ensure notifications is always an array
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const visibleNotifications = safeNotifications.filter(n => !deletedNotificationIds.includes(n.id));
  const unreadNotifications = visibleNotifications.filter(n => !n.is_read);

  const emptyScores = { total: 0, function: 0, food: 0, flora: 0, flow: 0 };
  const dashboardScores = user ? calculateFertyScore(user, logs) : emptyScores;
  const dashboardDaysActive = calculateDaysOnMethod(user?.methodStartDate);
  const dashboardProgress = Math.min(100, dashboardDaysActive > 0 ? (dashboardDaysActive / 90) * 100 : 0);

  const showNotif = (msg: string, type: 'success' | 'error') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 4000);
  };


  const handleRestartMethod = async () => {
    if (!user?.id) return;
    const { error } = await supabase.from('profiles').update({ method_start_date: null }).eq('id', user.id);
    if (error) {
      showNotif('No se pudo reiniciar el método', 'error');
      return;
    }
    setUser(user ? { ...user, methodStartDate: null } : null);
    showNotif('Método reiniciado correctamente', 'success');
  };

  // Wrapper functions using centralized services
  // These wrappers handle state updates and todayLog initialization
  const fetchLogs = async (userId: string, daysLimit: number = 90) => {
    try {
      const mappedLogs = await fetchLogsForUser(userId, daysLimit);
      setLogs(mappedLogs);
      const todayStr = formatDateForDB(new Date());
      const existingToday = mappedLogs.find(l => l.date === todayStr);
      
      // Always calculate cycleDay based on user's lastPeriodDate, not from previous logs
      if (user?.lastPeriodDate && user?.cycleLength) {
        const currentCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
        
        if (existingToday) {
          // Update existing log with correct cycleDay
          setTodayLog({ ...existingToday, cycleDay: currentCycleDay });
        } else {
          // Create new today log with correct cycleDay
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
        // Fallback: if no user cycle data, use last log (shouldn't happen normally)
        const last = mappedLogs[0];
        const diff = Math.ceil(Math.abs(new Date().getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24));
        setTodayLog(p => ({ ...p, date: todayStr, cycleDay: (last.cycleDay + diff) || 1, symptoms: [], alcohol: false, lhTest: 'No realizado', activityMinutes: 0, sunMinutes: 0 }));
      }
      return mappedLogs;
    } catch (error) {
      logger.error('❌ Error fetching logs:', error);
      showNotif('Error cargando registros. Intenta recargar la página.', 'error');
      return [];
    }
  };

  const fetchAllLogs = async (userId: string) => {
    try {
      const mappedLogs = await fetchAllLogsForUser(userId);
      setLogs(mappedLogs);
      return mappedLogs;
    } catch (error) {
      logger.error('❌ Error fetching all logs:', error);
      showNotif('Error cargando historial completo. Intenta recargar la página.', 'error');
      return [];
    }
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const activeNotifications = await fetchNotificationsForUser(userId);
      setNotifications(activeNotifications);
    } catch (error) {
      logger.error('❌ Error fetching notifications:', error);
      setNotifications([]);
    }
  };

  const fetchReports = async (userId: string) => {
    try {
      const reports = await fetchReportsForUser(userId);
      setReports(reports);
    } catch (error) {
      logger.error('❌ Error fetching reports:', error);
    }
  };

  const fetchUserForms = async (userId: string) => {
    try {
      const forms = await fetchUserFormsForUser(userId);
      setSubmittedForms(forms);
    } catch (error) {
      logger.error('❌ Error fetching forms:', error);
      showNotif('Error cargando formularios. Intenta recargar la página.', 'error');
    }
  };

  const fetchEducation = async (userId: string, methodStart?: string) => {
    try {
      const modules = await fetchEducationForUser(userId, methodStart);
      setCourseModules(modules);
    } catch (error) {
      logger.error('❌ Error fetching education:', error);
      setCourseModules([]);
    }
  };


  // Track if data has been loaded to avoid multiple loads
  const [dataLoaded, setDataLoaded] = useState(false);

  // Check user session on mount using hook
  useEffect(() => { 
    checkUser(); 
  }, []);

  // Load user data after authentication
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id || dataLoaded) return;
      
      logger.log('🔄 Fetching user data...');
      
      try {
        // Load data in parallel for better performance
        await Promise.all([
          fetchLogs(user.id),
          fetchUserForms(user.id),
          fetchNotifications(user.id),
          fetchEducation(user.id, user.methodStartDate || undefined),
        ]);
        
        // Load reports only for subscribers/admins
        const currentUser = useAppStore.getState().user;
        if (currentUser && (currentUser.role === 'admin' || (currentUser as any).user_type === 'subscriber')) {
          await fetchReports(user.id);
        }
        
        logger.log('✅ Data fetched successfully');
        setDataLoaded(true);
      } catch (error) {
        logger.error('❌ Error loading user data:', error);
      }
    };

    // Only load data if user is authenticated and view allows it
    if (user?.id && (view === 'DASHBOARD' || view === 'DISCLAIMER') && !dataLoaded) {
      loadUserData();
    }
  }, [user?.id, view]); // Removed dataLoaded from dependencies to avoid circular updates

  // Reset dataLoaded flag when user logs out
  useEffect(() => {
    if (!user) {
      setDataLoaded(false);
    }
  }, [user]);

  // Note: checkUser function removed - using hook's checkUser instead

  // Handle authentication using hook
  const handleAuth = async () => {
    setAuthError('');
    const success = await authHandleAuth(email, password, name, isSignUp);
    
    if (isSignUp && success) {
      showNotif("¡Registro exitoso! Revisa tu email.", 'success');
      setIsSignUp(false);
    }
    // Data loading will be handled by useEffect when user is set
  };

  const markNotificationRead = async (notifId: number) => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
      
      if (error) {
        logger.error('Error marking notification as read:', error);
        showNotif('No pudimos marcar la notificación como leída. Intenta nuevamente.', 'error');
        return;
      }
      
      // Only update local state if database update was successful
      setNotifications(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.map(n => n.id === notifId ? { ...n, is_read: true } : n);
      });
    } catch (error) {
      logger.error('Error in markNotificationRead:', error);
      showNotif('Error inesperado al marcar la notificación. Intenta nuevamente.', 'error');
    }
  };

  // Delete a notification completely
  // Delete a notification (Soft Delete)
  const deleteNotification = async (notifId: number) => {
    try {
      // 1. Server Soft Delete (Update metadata) - Do this first
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

      // 2. Only update local state if database update was successful
      const newDeletedIds = [...deletedNotificationIds, notifId];
      setDeletedNotificationIds(newDeletedIds);
      localStorage.setItem('fertyfit_deleted_notifications', JSON.stringify(newDeletedIds));

      // 3. Optimistic UI Update
      setNotifications(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.filter(n => n.id !== notifId);
      });
      
      logger.log('✅ Notification soft-deleted', notifId);
    } catch (error) {
      logger.error('Error in deleteNotification:', error);
      showNotif('Error inesperado al eliminar la notificación. Intenta nuevamente.', 'error');
    }
  };

  // refreshUserProfile is now provided by useAuth hook

  const handleNotificationAction = async (notification: AppNotification, action: NotificationAction) => {
    if (!user?.id) return;

    // Validate handler type safety
    if (!isValidNotificationHandler(action.handler)) {
      logger.warn('Invalid notification handler:', action.handler);
      showNotif('Acción no válida. Por favor, intenta nuevamente.', 'error');
      return;
    }

    try {
      if (action.handler === 'handlePeriodConfirmed') {
        const today = formatDateForDB(new Date());
        await handlePeriodConfirmed(user.id, today);
        // Recargar el perfil completo desde la base de datos para sincronizar todas las vistas
        await refreshUserProfile(user.id);
        showNotif('¡Gracias! Actualizamos tu ciclo.', 'success');
      } else if (action.handler === 'handlePeriodDelayed') {
        const parsedDays = typeof action.value === 'number' 
          ? action.value 
          : Number(action.value);
        const daysToAdd = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 2;
        await handlePeriodDelayed(user.id, daysToAdd);
        // Recargar el perfil completo desde la base de datos para sincronizar todas las vistas
        await refreshUserProfile(user.id);
        if (user) {
          showNotif(`Entendido. Ajustamos tu ciclo a ${user.cycleLength} días.`, 'success');
        }
      } else if (action.handler === 'handleOvulationDetected') {
        // Future handler for ovulation detection
        logger.log('Ovulation detected handler called');
        showNotif('Ovulación detectada. ¡Excelente momento para intentar!', 'success');
      } else {
        logger.warn('Unhandled notification action:', action.handler);
        return;
      }

      await markNotificationRead(notification.id);
      await fetchNotifications(user.id);
    } catch (error) {
      logger.error('Error handling notification action', error);
      showNotif('No pudimos actualizar tu información. Intenta nuevamente.', 'error');
    }
  };

  const analyzeLogsWithAI = async (userId: string, recentLogs: DailyLog[], context: 'f0' | 'f0_update' | 'daily' = 'daily') => {
    try {
      logger.log('🤖 AI Analysis triggered:', { context, userId });

      if (context === 'f0' || context === 'f0_update') {
        // Fetch fresh profile data to ensure we have the latest F0 answers
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

        if (!profile) return;

        // Usar nuevo servicio de Gemini
        const aiMessage = await generateF0Notification({
          name: profile.name,
          age: profile.age,
          main_objective: profile.main_objective,
          time_trying: profile.time_trying,
          diagnoses: profile.diagnoses,
          partner_status: profile.partner_status,
        });

        let title = context === 'f0' ? '🌸 Bienvenida a FertyFit' : '✨ Perfil Actualizado';
        let message = aiMessage || (context === 'f0'
          ? '¡Bienvenida! Estamos aquí para acompañarte en tu camino hacia la fertilidad.'
          : 'Hemos actualizado tu perfil. Tus nuevos datos nos ayudarán a darte mejores recomendaciones.');

        // CHECK FOR DUPLICATES BEFORE INSERTING
        const localSentKey = `fertyfit_welcome_sent_${userId}`;
        const alreadySentLocal = localStorage.getItem(localSentKey);

        const { data: existingNotifs } = await supabase.from('notifications').select('id').eq('user_id', userId).eq('title', title);

        if ((!existingNotifs || existingNotifs.length === 0) && !alreadySentLocal) {
          const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            title,
            message,
            type: 'celebration',
            priority: 3
          });
          if (!error) {
            localStorage.setItem(localSentKey, 'true');
          }
          logger.log('✅ F0 AI notification created:', { title, success: !error });
        } else {
          logger.log('⚠️ Notification already exists or sent previously, skipping:', title);
        }
      } else {
        // Daily logs: Generate TWO notifications using Gemini API
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

        if (!profile) {
          logger.error('❌ No profile found for AI notification');
          return;
        }

        const logSummary = recentLogs.slice(0, 14).map(log => ({
          date: log.date,
          cycleDay: log.cycleDay,
          bbt: log.bbt,
          mucus: log.mucus,
          stressLevel: log.stressLevel,
          sleepHours: log.sleepHours,
          symptoms: log.symptoms,
          lhTest: log.lhTest,
          alcohol: log.alcohol,
          veggieServings: log.veggieServings
        }));

        // 1. POSITIVE NOTIFICATION
        const positiveMessage = await generateLogAnalysis(
          {
            name: profile.name,
            age: profile.age,
            main_objective: profile.main_objective,
            diagnoses: profile.diagnoses,
            time_trying: profile.time_trying,
            cycle_length: profile.cycle_length,
            cycle_regularity: profile.cycle_regularity,
          },
          logSummary,
          'positive'
        );

        if (positiveMessage) {
          const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            title: '💚 Aspecto Positivo Detectado',
            message: positiveMessage,
            type: 'celebration',
            priority: 2
          });
          logger.log('✅ Positive AI notification created:', { success: !error });
        }

        // 2. ALERT NOTIFICATION
        const alertMessage = await generateLogAnalysis(
          {
            name: profile.name,
            age: profile.age,
            main_objective: profile.main_objective,
            diagnoses: profile.diagnoses,
            time_trying: profile.time_trying,
            cycle_length: profile.cycle_length,
            cycle_regularity: profile.cycle_regularity,
          },
          logSummary,
          'alert'
        );

        if (alertMessage) {
          const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            title: '⚠️ Área de Atención',
            message: alertMessage,
            type: 'alert',
            priority: 2
          });
          logger.log('✅ Alert AI notification created:', { success: !error });
        }
      }

      fetchNotifications(userId);

    } catch (error) {
      logger.error('Error analyzing with AI:', error);
    }
  };

  const saveDailyLog = async () => {
    if (!user?.id) return;
    if (!todayLog.date) { showNotif("La fecha es obligatoria", 'error'); return; }
    if (!todayLog.bbt) { showNotif("La temperatura (BBT) es obligatoria", 'error'); return; }
    if (!todayLog.mucus) { showNotif("El registro de moco cervical es obligatorio", 'error'); return; }
    if (!todayLog.stressLevel) { showNotif("El nivel de estrés es obligatorio", 'error'); return; }
    if (todayLog.sleepHours === undefined || todayLog.sleepHours === null) { showNotif("Las horas de sueño son obligatorias", 'error'); return; }
    const validDate = formatDateForDB(new Date(todayLog.date)); // Ensure date is valid and formatted
    
    // Always calculate cycleDay based on user's lastPeriodDate for consistency
    let correctCycleDay = todayLog.cycleDay || 1;
    if (user.lastPeriodDate && user.cycleLength) {
      correctCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
    }
    
    const formattedLog = { ...todayLog, date: validDate, cycleDay: correctCycleDay };

    const { error } = await supabase.from('daily_logs').upsert(mapLogToDB(formattedLog as DailyLog, user.id), { onConflict: 'user_id, date' });
    if (!error) {
      showNotif("Registro guardado con éxito", 'success');
      await fetchLogs(user.id);

      // AI Notification Logic:
      // 1. First daily log ever -> Generate AI
      // 2. Every 7 days after first -> Generate AI
      const updatedLogs = await supabase.from('daily_logs').select('*').eq('user_id', user.id).order('date', { ascending: false });

      // Note: Rule engine evaluation happens in useEffect (DAILY_CHECK trigger)
      // This ensures rules are evaluated once per day, not on every log save
      // to avoid notification spam
      await fetchNotifications(user.id);

      if (updatedLogs.data && updatedLogs.data.length > 0) {
        const totalLogs = updatedLogs.data.length;
        const { data: profileData } = await supabase.from('profiles').select('last_ai_notification_date').eq('id', user.id).single();
        const lastAiDate = profileData?.last_ai_notification_date;

        let shouldGenerateAI = false;

        if (totalLogs === 1) {
          // First daily log ever
          shouldGenerateAI = true;
        } else if (lastAiDate) {
          // Check if 7 days have passed since last AI notification
          const daysSinceLastAI = Math.floor((new Date().getTime() - new Date(lastAiDate).getTime()) / (1000 * 3600 * 24));
          if (daysSinceLastAI >= 7) {
            shouldGenerateAI = true;
          }
        }

        if (shouldGenerateAI) {
          analyzeLogsWithAI(user.id, updatedLogs.data.map(mapLogFromDB), 'daily');
          await supabase.from('profiles').update({ last_ai_notification_date: new Date().toISOString() }).eq('id', user.id);
        }
      }

      setView('DASHBOARD');
    } else {
      showNotif("Error al guardar: " + error.message, 'error');
    }
  };

  const startMethod = async () => {
    if (!user?.id) return;

    // Check if F0 is completed
    const hasF0 = submittedForms.some(f => f.form_type === 'F0');
    if (!hasF0) {
      showNotif('Debes completar el formulario F0 antes de iniciar el método.', 'error');
      setView('CONSULTATIONS');
      return;
    }

    const startDate = new Date().toISOString();
    const { error } = await supabase.from('profiles').update({ method_start_date: startDate }).eq('id', user.id);
    if (!error) {
      const updatedUser = { ...user, methodStartDate: startDate };
      setUser(updatedUser);
      showNotif("¡Método Activado! Bienvenida al Día 1.", 'success');
      fetchEducation(user.id, startDate);
      setCurrentPhase(1);
      setShowPhaseModal(true);
    } else {
      showNotif("Error: " + error.message, 'error');
    }
  };

  const acceptDisclaimer = async () => {
    if (!user?.id) return;
    const { error } = await supabase.from('profiles').update({ disclaimer_accepted: true }).eq('id', user.id);
    if (!error) {
      setUser({ ...user, disclaimerAccepted: true });
      setView('DASHBOARD');
    }
  };

  const markLessonComplete = async (lessonId: number) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert({ user_id: user.id, lesson_id: lessonId }, { onConflict: 'user_id, lesson_id' });
      
      if (error) {
        logger.error('Error marking lesson as complete:', error);
        showNotif('No pudimos marcar la lección como completada. Intenta nuevamente.', 'error');
        return;
      }
      
      // Update local state optimistically
      setCourseModules(prev => {
        try {
          const safePrev = Array.isArray(prev) ? prev : [];
          if (safePrev.length === 0) {
            logger.warn('courseModules is empty, cannot update lesson completion');
            return safePrev;
          }
          
          const updated = safePrev.map(m => {
            try {
              // Ensure all required properties exist
              if (!m || typeof m.id === 'undefined') {
                logger.warn('Invalid module found:', m);
                return m;
              }
              
              const safeLessons = Array.isArray(m.lessons) ? m.lessons : [];
              const safeCompletedLessons = Array.isArray(m.completedLessons) ? m.completedLessons : [];
              const hasLesson = safeLessons.some(l => l && l.id === lessonId);
              
              // Use spread operator to preserve all existing properties, then override only what we need
              return {
                ...m,
                lessons: safeLessons,
                completedLessons: hasLesson && !safeCompletedLessons.includes(lessonId) 
                  ? [...safeCompletedLessons, lessonId] 
                  : safeCompletedLessons
              };
            } catch (err) {
              logger.error('Error updating module:', err, m);
              return m; // Return original module if update fails
            }
          });
          
          logger.log('Updated courseModules after marking lesson complete:', updated.length, 'modules');
          return updated;
        } catch (err) {
          logger.error('Error in setCourseModules:', err);
          return prev; // Return previous state if update fails
        }
      });
      
      // Refetch education data to ensure consistency
      if (user?.id && user?.methodStartDate) {
        // Use setTimeout to avoid calling async function during state update
        setTimeout(() => {
          fetchEducation(user.id, user.methodStartDate);
        }, 100);
      }
      
      showNotif("Lección completada", 'success');
      setActiveLesson(null);
    } catch (error) {
      logger.error('Error in markLessonComplete:', error);
      showNotif('Error inesperado al marcar la lección. Intenta nuevamente.', 'error');
    }
  };



  const handleModalClose = (dontShowAgain: boolean) => {
    if (user?.id && dontShowAgain) {
      localStorage.setItem('fertyfit_phase_seen_' + user.id + '_' + currentPhase, 'true');
    }
    setShowPhaseModal(false);
  };

  const handleDateChange = (newDate: string) => {
    const existingLog = logs.find(l => l.date === newDate);
    if (existingLog) {
      // Always recalculate cycleDay based on user's lastPeriodDate for consistency
      if (user?.lastPeriodDate && user?.cycleLength) {
        const correctCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
        setTodayLog({ ...existingLog, cycleDay: correctCycleDay > 0 ? correctCycleDay : 1 });
      } else {
      setTodayLog(existingLog);
      }
    } else {
      // Calculate cycle day based on user's lastPeriodDate, not from previous logs
      let newCycleDay = 1;

      if (user?.lastPeriodDate && user?.cycleLength) {
        // Use the unified calculation function
        newCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
      }
      // Nota: Ya no se usa F0 para obtener lastPeriodDate, solo se maneja desde el perfil/TrackerView

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
  };

  // --- Sub-Views ---

  const DisclaimerView = () => (
    <div className="p-6 bg-white min-h-screen flex flex-col items-center justify-center">
      <div className="bg-[#F4F0ED] p-8 rounded-3xl border border-[#C7958E]/20 max-w-sm w-full shadow-xl">
        <h3 className="font-bold text-[#95706B] mb-4 flex items-center gap-2 text-lg"><AlertCircle size={24} /> Aviso Importante</h3>
        <p className="text-sm text-[#5D7180] leading-relaxed text-justify mb-6">
          FertyFit es un programa educativo. La información aquí presentada no sustituye el consejo médico profesional, diagnóstico o tratamiento.
          Al continuar, aceptas que eres responsable de tu salud y consultarás con tu médico cualquier cambio.
        </p>
        <button onClick={acceptDisclaimer} className="w-full bg-[#C7958E] text-white py-4 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-[#95706B] transition-colors">
          Acepto y Continuar
        </button>
      </div>
    </div>
  );

  // Tracker view extracted to views/Tracker/TrackerView


  // --- RENDER CONTENT ---
  if (activeLesson) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F4F0ED]/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/50 max-h-[90vh] flex flex-col">
          <div className="p-5 border-b border-[#F4F0ED] flex justify-between items-center bg-white sticky top-0 z-10">
            <h3 className="font-bold text-[#4A4A4A] text-sm pr-4">{activeLesson.title}</h3>
            <button onClick={() => setActiveLesson(null)}><X size={24} className="text-[#95706B] hover:rotate-90 transition-transform" /></button>
          </div>

          <div className="overflow-y-auto custom-scrollbar">
            {activeLesson.type === 'video' ? (
              <div className="aspect-video bg-black">
                {activeLesson.content_url && activeLesson.content_url.includes('http') ? (
                  <iframe
                    src={getEmbedUrl(activeLesson.content_url) + '?origin=' + window.location.origin + '&rel=0'}
                    title={activeLesson.title}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <p>Video no disponible</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 bg-[#F4F0ED]/30 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-[#C7958E]">
                  <PdfIcon size={40} />
                </div>
                <p className="text-xs font-bold text-[#95706B] mb-4 uppercase tracking-wider">Recurso Descargable</p>
                <a
                  href={activeLesson.content_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#4A4A4A] text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg hover:bg-black transition-colors"
                >
                  <Download size={16} /> Descargar PDF
                </a>
              </div>
            )}

            <div className="p-6">
              <h4 className="text-xs font-bold text-[#95706B] uppercase tracking-widest mb-2">Acerca de esta lección</h4>
              <p className="text-sm text-[#5D7180] leading-relaxed mb-8">
                {activeLesson.description || "No hay descripción disponible para esta lección."}
              </p>

              <button
                onClick={() => markLessonComplete(activeLesson.id)}
                className="w-full bg-[#C7958E] text-white py-4 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-[#95706B] transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle size={20} /> Marcar como Completada
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#F4F0ED]">
      <div className="animate-pulse flex flex-col items-center">
        <img src={BRAND_ASSETS.favicon} alt="Loading" className="w-12 h-12 mb-4 animate-bounce" />
        <p className="text-[#C7958E] font-bold text-sm tracking-widest">CARGANDO...</p>
      </div>
    </div>
  );

  // --- ONBOARDING / LOGIN ---
  if (view === 'ONBOARDING' || !user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F0ED] p-6 font-sans relative overflow-hidden">
      {notif && <Notification message={notif.msg} type={notif.type} onClose={() => setNotif(null)} />}

      {/* Background decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#C7958E]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-[#95706B]/10 rounded-full blur-3xl"></div>

      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2rem] shadow-xl w-full max-w-sm border border-white relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src={BRAND_ASSETS.logo} alt="FertyFit" className="h-20 object-contain mb-2" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#95706B] font-medium text-center">Function • Food • Flora • Flow</p>
        </div>

        <div className="space-y-4">
          {isSignUp && (
            <div className="relative group animate-in slide-in-from-top duration-300">
              <User className="absolute left-4 top-4 text-[#95706B] group-focus-within:text-[#C7958E] transition-colors" size={20} />
              <input
                type="text"
                placeholder="Tu Nombre"
                className="w-full bg-[#F4F0ED] border-transparent focus:bg-white border focus:border-[#C7958E] rounded-2xl py-4 pl-12 pr-4 text-sm outline-none transition-all text-[#4A4A4A]"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          )}
          <div className="relative group">
            <Mail className="absolute left-4 top-4 text-[#95706B] group-focus-within:text-[#C7958E] transition-colors" size={20} />
            <input
              type="email"
              placeholder="Tu Email"
              className="w-full bg-[#F4F0ED] border-transparent focus:bg-white border focus:border-[#C7958E] rounded-2xl py-4 pl-12 pr-4 text-sm outline-none transition-all text-[#4A4A4A]"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="relative group">
            <Key className="absolute left-4 top-4 text-[#95706B] group-focus-within:text-[#C7958E] transition-colors" size={20} />
            <input
              type="password"
              placeholder="Tu Contraseña"
              className="w-full bg-[#F4F0ED] border-transparent focus:bg-white border focus:border-[#C7958E] rounded-2xl py-4 pl-12 pr-4 text-sm outline-none transition-all text-[#4A4A4A]"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
        </div>

        {authError && (
          <div className="bg-rose-50 text-rose-600 text-xs p-4 rounded-xl mt-4 flex items-start gap-2 border border-rose-100">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <button
          onClick={handleAuth}
          disabled={!email || !password || (isSignUp && !name)}
          className="w-full bg-gradient-to-r from-[#C7958E] to-[#95706B] text-white py-4 rounded-2xl font-bold shadow-lg shadow-rose-200/50 mt-6 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isSignUp ? 'Crear Cuenta Gratis' : 'Iniciar Sesión'}
        </button>

        <div className="text-center mt-8 pt-6 border-t border-[#F4F0ED]">
          <p className="text-xs text-[#5D7180] mb-2">
            {isSignUp ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}
          </p>
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-[#C7958E] font-bold text-sm hover:underline">
            {isSignUp ? 'Entra aquí' : 'Regístrate ahora'}
          </button>
        </div>

        {isSignUp && (
          <div className="bg-blue-50 text-blue-600 text-[10px] p-3 rounded-xl mt-4 flex gap-2 items-center">
            <Mail size={14} />
            <span>Importante: Te enviaremos un email de confirmación.</span>
          </div>
        )}
      </div>
    </div>
  );

  if (view === 'DISCLAIMER') {
    return <DisclaimerView />;
  }

  // --- DASHBOARD & MAIN VIEW ---

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#F4F0ED] shadow-2xl relative overflow-hidden font-sans text-[#4A4A4A]">
      {showPhaseModal && <PhaseIntroModal phase={currentPhase} onClose={handleModalClose} />}
      {notif && <Notification message={notif.msg} type={notif.type} onClose={() => setNotif(null)} />}

      <div className="h-full overflow-y-auto custom-scrollbar">
        {view === 'PROFILE' && user ? (
          <Suspense fallback={<ViewLoading />}>
          <ProfileView
            user={user}
            logs={logs}
            submittedForms={submittedForms}
            reports={reports}
            scores={dashboardScores}
            visibleNotifications={visibleNotifications}
            showNotif={showNotif}
            setView={setView}
            fetchUserForms={fetchUserForms}
            setUser={setUser}
            markNotificationRead={markNotificationRead}
            deleteNotification={deleteNotification}
            onNotificationAction={handleNotificationAction}
            onRestartMethod={handleRestartMethod}
            onLogout={handleLogout}
            fetchAllLogs={fetchAllLogs}
            setLogs={setLogs}
          />
          </Suspense>
        ) : (
          <div className="p-5">
            {view === 'DASHBOARD' && user && (
              <Suspense fallback={<ViewLoading />}>
              <DashboardView
                user={user}
                logs={logs}
                todayLog={todayLog}
                scores={dashboardScores}
                progressPercent={dashboardProgress}
                daysActive={dashboardDaysActive}
                unreadNotifications={unreadNotifications}
                submittedForms={submittedForms}
                onStartMethod={startMethod}
                onNavigate={setView}
                showNotif={showNotif}
                onMarkNotificationRead={markNotificationRead}
                onDeleteNotification={deleteNotification}
                onNotificationAction={handleNotificationAction}
              />
              </Suspense>
            )}
            {view === 'TRACKER' && (
              <Suspense fallback={<ViewLoading />} key={`tracker-${user?.lastPeriodDate || 'no-date'}`}>
              <TrackerView
                todayLog={todayLog}
                setTodayLog={setTodayLog}
                submittedForms={submittedForms}
                logs={logs}
                handleDateChange={handleDateChange}
                saveDailyLog={saveDailyLog}
                  user={user}
                  onUserUpdate={async (updatedUser) => {
                    setUser(updatedUser);
                    // Refrescar perfil completo y formularios para sincronizar todas las vistas
                    if (updatedUser?.id) {
                      await refreshUserProfile(updatedUser.id);
                      await fetchUserForms(updatedUser.id);
                    }
                  }}
                  showNotif={showNotif}
                  fetchUserForms={fetchUserForms}
              />
              </Suspense>
            )}
            {view === 'EDUCATION' && (
              <Suspense fallback={<ViewLoading />}>
              <EducationView
                courseModules={Array.isArray(courseModules) ? courseModules : []}
                onSelectLesson={setActiveLesson}
              />
              </Suspense>
            )}
            {view === 'CONSULTATIONS' && user && (
              <Suspense fallback={<ViewLoading />}>
              <ConsultationsView
                user={user}
                logs={logs}
                submittedForms={submittedForms}
                showNotif={showNotif}
                fetchUserForms={fetchUserForms}
              />
              </Suspense>
            )}
          </div>
        )}
      </div>
      <nav className="fixed bottom-0 max-w-md w-full bg-white border-t border-[#F4F0ED] px-6 py-2 flex justify-between rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
        <NavButton active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} icon={Heart} label="Inicio" />
        <NavButton
          active={view === 'TRACKER'}
          onClick={() => {
            const hasF0 = submittedForms.some(f => f.form_type === 'F0');
            if (!hasF0) {
              showNotif('Debes completar el F0 antes de registrar datos diarios', 'error');
              setView('CONSULTATIONS');
            } else {
              setView('TRACKER');
            }
          }}
          icon={Activity}
          label="Diario"
        />
        <NavButton active={view === 'EDUCATION'} onClick={() => setView('EDUCATION')} icon={BookOpen} label="Aprende" />
        <NavButton active={view === 'CONSULTATIONS'} onClick={() => setView('CONSULTATIONS')} icon={FileText} label="Consultas" />
        <NavButton active={view === 'PROFILE'} onClick={() => setView('PROFILE')} icon={User} label="Perfil" />
      </nav>
    </div >
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}