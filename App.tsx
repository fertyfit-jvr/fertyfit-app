import React, { Component, useState, useEffect, ErrorInfo, ReactNode } from 'react';
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
import { calculateAverages, calculateAlcoholFreeStreak, getLastLogDetails, formatDateForDB, calculateBMI, calculateVitalityStats, getBMIStatus } from './services/dataService';
import { supabase } from './services/supabase';
import { evaluateRules, saveNotifications, calcularDiaDelCiclo, handlePeriodConfirmed, handlePeriodDelayed } from './services/RuleEngine';
import { generarDatosInformeMedico } from './services/MedicalReportHelpers';
import { generateF0Notification, generateLogAnalysis } from './services/googleCloud/geminiService';
import { useAppStore } from './store/useAppStore';
import Notification from './components/common/Notification';
import LogHistoryItem from './components/common/LogHistoryItem';
import TrackerView from './views/Tracker/TrackerView';
import DashboardView from './views/Dashboard/DashboardView';
import EducationView from './views/Education/EducationView';
import ConsultationsView from './views/Consultations/ConsultationsView';
import ProfileView from './views/Profile/ProfileView';
import PhaseIntroModal from './components/common/PhaseIntroModal';
import NavButton from './components/common/NavButton';
import StatCard from './components/common/StatCard';

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
    console.error("App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F0ED] p-6 text-center font-sans">
          <h1 className="text-2xl font-bold text-[#95706B] mb-4">Algo salió mal</h1>
          <p className="text-[#5D7180] mb-6">Lo sentimos. Ha ocurrido un error inesperado.</p>
          <button
            onClick={() => window.location.href = 'https://fertyfit.com'}
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

const calculateStandardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const calculateFertyScore = (user: UserProfile, logs: DailyLog[]) => {
  const recentLogs = logs.slice(0, 14);
  const avgs = recentLogs.length > 0 ? calculateAverages(recentLogs) : { sleep: '0', veggies: '0', stress: '0' };

  // ========================================
  // PILAR 1: FUNCTION (25%) - Physical Health
  // ========================================
  let functionScore = 100;

  // BMI Logic (optimal 20-25)
  const bmi = calculateBMI(user.weight, user.height);
  const bmiVal = parseFloat(bmi);
  if (!isNaN(bmiVal)) {
    if (bmiVal < 18.5) functionScore -= (18.5 - bmiVal) * 8; // Underweight penalty
    else if (bmiVal >= 18.5 && bmiVal <= 25) functionScore = 100; // Optimal
    else if (bmiVal > 25) functionScore -= (bmiVal - 25) * 3; // Overweight penalty
  }

  // Age Logic (optimal <35)
  if (user.age > 35) {
    functionScore -= (user.age - 35) * 2;
  } else if (user.age < 25) {
    functionScore -= (25 - user.age) * 1;
  }

  // Diagnoses Impact
  const riskyDiagnoses = ['SOP', 'Endometriosis', 'Ovarios Poliquísticos', 'PCOS'];
  if (user.diagnoses && user.diagnoses.some(d => riskyDiagnoses.some(rd => d.includes(rd)))) {
    functionScore -= 20;
  }

  // Smoking (major impact on function)
  if (user.smoker && user.smoker.toLowerCase() !== 'no') {
    functionScore -= 25;
  }

  functionScore = Math.max(0, Math.min(100, functionScore));

  // ========================================
  // PILAR 2: FOOD (25%) - Nutrition & Habits
  // ========================================
  let foodScore = 0;

  if (recentLogs.length > 0) {
    // Vegetable intake (target 5 servings)
    const veggieScore = Math.min(100, (parseFloat(avgs.veggies) / 5) * 100);

    // Alcohol penalty (>2 days in 14 = bad)
    const alcoholDays = recentLogs.filter(l => l.alcohol).length;
    const alcoholScore = alcoholDays > 2 ? Math.max(0, 100 - (alcoholDays * 10)) : 100;

    // Supplements bonus (if taking supplements)
    // TODO: Add supplements tracking from F0
    const supplementsScore = 80; // Placeholder - will be calculated from F0 data

    foodScore = (veggieScore * 0.4) + (alcoholScore * 0.4) + (supplementsScore * 0.2);
  } else {
    foodScore = 70; // Default baseline
  }

  foodScore = Math.max(0, Math.min(100, foodScore));

  // ========================================
  // PILAR 3: FLORA (25%) - Microbiota & Rest
  // ========================================
  let floraScore = 0;

  if (recentLogs.length > 0) {
    // Sleep quality (target 7.5 hours)
    const sleepVal = parseFloat(avgs.sleep);
    let sleepScore = 0;
    if (sleepVal >= 7 && sleepVal <= 9) {
      sleepScore = 100; // Optimal
    } else if (sleepVal < 7) {
      sleepScore = Math.max(0, (sleepVal / 7) * 100);
    } else {
      sleepScore = Math.max(0, 100 - ((sleepVal - 9) * 10));
    }

    // Digestive health (based on symptoms)
    // TODO: Track digestive symptoms in daily logs
    const digestiveScore = 80; // Placeholder

    // Probiotics/Gut health
    // TODO: Add from F0 supplements
    const gutHealthScore = 75; // Placeholder

    floraScore = (sleepScore * 0.5) + (digestiveScore * 0.3) + (gutHealthScore * 0.2);
  } else {
    floraScore = 70; // Default baseline
  }

  floraScore = Math.max(0, Math.min(100, floraScore));

  // ========================================
  // PILAR 4: FLOW (25%) - Stress & Emotional
  // ========================================
  let flowScore = 0;

  if (recentLogs.length > 0) {
    // Stress levels (1=best, 5=worst)
    const stressVal = parseFloat(avgs.stress);
    const stressScore = Math.max(0, ((5 - stressVal) / 4) * 100);

    // Cycle regularity
    const regularityScore = user.cycleRegularity === 'Regular' ? 100 :
      (user.cycleRegularity === 'Irregular' ? 50 : 75);

    // BBT Stability (hormonal flow)
    const bbtValues = recentLogs.map(l => l.bbt).filter(b => b !== undefined && b > 0) as number[];
    let bbtScore = 75; // Default
    if (bbtValues.length >= 3) {
      const sd = calculateStandardDeviation(bbtValues);
      if (sd <= 0.2) bbtScore = 100;
      else if (sd >= 0.5) bbtScore = 40;
      else bbtScore = 100 - ((sd - 0.2) * 200);
    }

    // Emotional wellbeing
    // TODO: Add happiness/mood tracking
    const emotionalScore = 80; // Placeholder

    flowScore = (stressScore * 0.3) + (regularityScore * 0.3) + (bbtScore * 0.2) + (emotionalScore * 0.2);
  } else {
    flowScore = 70; // Default baseline
  }

  flowScore = Math.max(0, Math.min(100, flowScore));

  // ========================================
  // TOTAL SCORE (Equal weight: 25% each)
  // ========================================
  const totalScore = (functionScore * 0.25) + (foodScore * 0.25) + (floraScore * 0.25) + (flowScore * 0.25);

  return {
    total: Math.round(totalScore),
    function: Math.round(functionScore),
    food: Math.round(foodScore),
    flora: Math.round(floraScore),
    flow: Math.round(flowScore)
  };
};





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
    profileTab, setProfileTab,
    deletedNotificationIds, setDeletedNotificationIds,
    isEditingProfile, setIsEditingProfile,
    editName, setEditName,
    isEditingF0, setIsEditingF0,
    f0Answers, setF0Answers
  } = useAppStore();

  // Filter notifications based on blacklist
  const visibleNotifications = notifications.filter(n => !deletedNotificationIds.includes(n.id));
  const unreadNotifications = visibleNotifications.filter(n => !n.is_read);

  const emptyScores = { total: 0, function: 0, food: 0, flora: 0, flow: 0 };
  const dashboardScores = user ? calculateFertyScore(user, logs) : emptyScores;
  const dashboardDaysActive = user?.methodStartDate
    ? Math.floor((new Date().getTime() - new Date(user.methodStartDate).getTime()) / (1000 * 3600 * 24)) + 1
    : 0;
  const dashboardProgress = Math.min(100, dashboardDaysActive > 0 ? (dashboardDaysActive / 90) * 100 : 0);

  const handleSaveProfile = async () => {
    if (!user) return;

    const { error } = await supabase.from('profiles').update({
      name: editName
    }).eq('id', user.id);

    if (!error) {
      setUser({ ...user, name: editName });
      setIsEditingProfile(false);
      showNotif('Perfil actualizado correctamente', 'success');
    } else {
      showNotif('Error al actualizar perfil', 'error');
    }
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

  // Initialize edit state when entering profile
  useEffect(() => {
    if (user && view === 'PROFILE') {
      setEditName(user.name);
    }
  }, [user, view]);

  useEffect(() => { checkUser(); }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (!user.lastPeriodDate || !user.cycleLength) {
      console.warn('🔁 Cycle tracking skipped - missing data', {
        userId: user.id,
        hasLastPeriodDate: Boolean(user.lastPeriodDate),
        hasCycleLength: Boolean(user.cycleLength)
      });
      return;
    }

    const todayKey = `fertyfit_daily_check_${user.id}`;
    const todayStr = formatDateForDB(new Date());
    if (localStorage.getItem(todayKey) === todayStr) return;

    const currentCycleDay = calcularDiaDelCiclo(user.lastPeriodDate, user.cycleLength);
    if (!currentCycleDay) return;

    let cancelled = false;

    const runDailyCheck = async () => {
      try {
        const ruleNotifications = await evaluateRules('DAILY_CHECK', {
          user,
          currentCycleDay
        });

        if (!cancelled && ruleNotifications.length > 0) {
          await saveNotifications(user.id!, ruleNotifications);
          await fetchNotifications(user.id);
        }
      } catch (err) {
        console.error('❌ Error running DAILY_CHECK trigger', err);
      } finally {
        if (!cancelled) {
          localStorage.setItem(todayKey, todayStr);
        }
      }
    };

    runDailyCheck();

    return () => { cancelled = true; };
  }, [user?.id, user?.lastPeriodDate, user?.cycleLength]);

  const showNotif = (msg: string, type: 'success' | 'error') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const checkUser = async () => {
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (session?.user) {
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

        if (error && error.code === '42P01') { setLoading(false); return; }

        if (error && (error.code === 'PGRST116' || !profile)) {
          // CREATE NEW PROFILE WITH NAME FROM METADATA OR EMAIL
          const metaName = session.user.user_metadata?.full_name;
          const emailName = session.user.email?.split('@')[0] || 'Usuario';
          const displayName = metaName || (emailName.charAt(0).toUpperCase() + emailName.slice(1));

          const { error: createError } = await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            name: displayName,
            age: 30,
            disclaimer_accepted: false
          });

          if (createError) {

            console.error("Profile creation failed:", createError);
          } else {
            // RECURSIVELY CALL CHECKUSER TO LOAD STATE WITHOUT RELOAD
            return checkUser();
          }
          setLoading(false); return;
        }

        if (profile) {
          setUser({
            id: session.user.id, email: session.user.email, joinedAt: profile.created_at,
            methodStartDate: profile.method_start_date,
            name: profile.name, age: profile.age, weight: profile.weight, height: profile.height, timeTrying: profile.time_trying,
            diagnoses: profile.diagnoses || [], treatments: [], disclaimerAccepted: profile.disclaimer_accepted, isOnboarded: true,
            mainObjective: profile.main_objective, partnerStatus: profile.partner_status,
            role: profile.role || 'user',
            // Add cycle and fertility fields
            cycleRegularity: profile.cycle_regularity,
            cycleLength: profile.cycle_length,
            lastPeriodDate: profile.last_period_date,
            fertilityTreatments: profile.fertility_treatments,
            supplements: profile.supplements,
            alcoholConsumption: profile.alcohol_consumption
          });

          // Determine phase
          let phase = 0;
          if (profile.method_start_date) {
            const start = new Date(profile.method_start_date);
            start.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
            const week = Math.ceil(days / 7) || 1;
            if (week >= 1 && week <= 4) phase = 1;
            else if (week >= 5 && week <= 8) phase = 2;
            else if (week >= 9) phase = 3;
          }
          setCurrentPhase(phase);

          // Show Phase Modal only once per phase
          const seenKey = `fertyfit_phase_seen_${session.user.id}_${phase}`;
          if (!localStorage.getItem(seenKey)) {
            setShowPhaseModal(true);
          }

          // Fetch data CRITICAL: Wait for data before showing dashboard
          console.log('🔄 Fetching user data...');
          const fetchedLogs = await fetchLogs(session.user.id);
          const fetchedForms = await fetchUserForms(session.user.id); // Assuming we might need this too, but for now logs is enough

          // RULE ENGINE: PERIODIC CHECK
          // We construct the user object same as above
          const currentUser = {
            id: session.user.id, email: session.user.email, joinedAt: profile.created_at,
            methodStartDate: profile.method_start_date,
            name: profile.name, age: profile.age, weight: profile.weight, height: profile.height, timeTrying: profile.time_trying,
            diagnoses: profile.diagnoses || [], treatments: [], disclaimerAccepted: profile.disclaimer_accepted, isOnboarded: true,
            mainObjective: profile.main_objective, partnerStatus: profile.partner_status,
            role: profile.role || 'user',
            // Add other fields if needed by rules
            cycleRegularity: profile.cycle_regularity,
            cycleLength: profile.cycle_length,
            lastPeriodDate: profile.last_period_date,
            fertilityTreatments: profile.fertility_treatments,
            supplements: profile.supplements,
            alcoholConsumption: profile.alcohol_consumption
          };

          if (fetchedLogs) {
            // TODO: Implement DAILY_CHECK trigger in useEffect
            // const ruleNotifs = await evaluateRules('PERIODIC', {
            //   user: currentUser as UserProfile,
            //   recentLogs: fetchedLogs
            // });
            // await saveNotifications(session.user.id, ruleNotifs);
          }

          await fetchNotifications(session.user.id);
          await fetchEducation(session.user.id, profile.method_start_date);

          if (profile.user_type === 'subscriber' || profile.role === 'admin') {
            await fetchReports(session.user.id);
          }

          console.log('✅ Data fetched successfully');

          if (!profile.disclaimer_accepted) setView('DISCLAIMER');
          else setView('DASHBOARD');
        }
      } else {
        setView('ONBOARDING');
      }
    } catch (err) {
      console.error('❌ Error in checkUser:', err);
      setAuthError('Error al cargar perfil: ' + (err as any).message);
      setView('ONBOARDING');
    } finally { setLoading(false); }
  };

  const handleAuth = async () => {
    setAuthError('');
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } } // Save Name to Metadata
        });
        if (error) setAuthError(error.message);
        else { showNotif("¡Registro exitoso! Revisa tu email.", 'success'); setIsSignUp(false); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setAuthError("Usuario no registrado o contraseña incorrecta.");
          } else {
            setAuthError(error.message);
          }
        } else {
          await checkUser();
        }
      }
    } catch (e: any) { setAuthError(e.message); } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setLogs([]);
    setView('ONBOARDING');
  };

  const fetchLogs = async (userId: string) => {
    const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', userId).order('date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching logs:', error);
      showNotif('Error cargando registros: ' + error.message, 'error');
      return;
    }

    if (data) {
      const mappedLogs = data.map(mapLogFromDB);
      setLogs(mappedLogs);
      const todayStr = formatDateForDB(new Date());
      const existingToday = mappedLogs.find(l => l.date === todayStr);
      if (existingToday) {
        setTodayLog(existingToday);
      } else if (mappedLogs.length > 0) {
        const last = mappedLogs[0];
        const diff = Math.ceil(Math.abs(new Date().getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24));
        setTodayLog(p => ({ ...p, date: todayStr, cycleDay: (last.cycleDay + diff) || 1, symptoms: [], alcohol: false, lhTest: 'No realizado', activityMinutes: 0, sunMinutes: 0 }));
      }
      return mappedLogs;
    }
    return [];
  };



  const fetchNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) console.error('❌ Error fetching notifications:', error);
    if (data) {
      // Filter out soft-deleted notifications (metadata.deleted === true)
      const activeNotifications = data.filter(n => !n.metadata?.deleted);
      setNotifications(activeNotifications);
    }
  };

  const fetchReports = async (userId: string) => {
    const { data, error } = await supabase.from('admin_reports').select('*').eq('user_id', userId).order('created_at', { ascending: false });

    if (error) console.error('❌ Error fetching reports:', error);
    if (data) {
      setReports(data);
    }
  };

  const markNotificationRead = async (notifId: number) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
  };

  // Delete a notification completely
  // Delete a notification (Soft Delete)
  const deleteNotification = async (notifId: number) => {
    // 1. Update Local State (Blacklist)
    const newDeletedIds = [...deletedNotificationIds, notifId];
    setDeletedNotificationIds(newDeletedIds);
    localStorage.setItem('fertyfit_deleted_notifications', JSON.stringify(newDeletedIds));

    // 2. Optimistic UI Update
    setNotifications(prev => prev.filter(n => n.id !== notifId));

    // 3. Server Soft Delete (Update metadata)
    // We fetch the current metadata first to preserve other fields if any
    const { data: current } = await supabase.from('notifications').select('metadata').eq('id', notifId).single();
    const newMeta = { ...(current?.metadata || {}), deleted: true };

    const { error } = await supabase.from('notifications').update({ metadata: newMeta }).eq('id', notifId);

    if (error) {
      console.error('Error deleting notification:', error);
    } else {
      console.log('✅ Notification soft-deleted', notifId);
    }
  };

  const handleNotificationAction = async (notification: AppNotification, action: NotificationAction) => {
    if (!user?.id) return;

    try {
      if (action.handler === 'handlePeriodConfirmed') {
        const today = formatDateForDB(new Date());
        await handlePeriodConfirmed(user.id, today);
        if (user) {
          setUser({ ...user, lastPeriodDate: today });
        }
        showNotif('¡Gracias! Actualizamos tu ciclo.', 'success');
      } else if (action.handler === 'handlePeriodDelayed') {
        const parsedDays = Number(action.value);
        const daysToAdd = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 2;
        const newLength = await handlePeriodDelayed(user.id, daysToAdd);
        if (user) {
          setUser({ ...user, cycleLength: newLength });
        }
        showNotif(`Entendido. Ajustamos tu ciclo a ${newLength} días.`, 'success');
      } else {
        console.warn('No handler registered for notification action', action);
        return;
      }

      await markNotificationRead(notification.id);
      await fetchNotifications(user.id);
    } catch (error) {
      console.error('Error handling notification action', error);
      showNotif('No pudimos actualizar tu información. Intenta nuevamente.', 'error');
    }
  };

  const analyzeLogsWithAI = async (userId: string, recentLogs: DailyLog[], context: 'f0' | 'f0_update' | 'daily' = 'daily') => {
    try {
      console.log('🤖 AI Analysis triggered:', { context, userId });

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
          console.log('✅ F0 AI notification created:', { title, success: !error });
        } else {
          console.log('⚠️ Notification already exists or sent previously, skipping:', title);
        }
      } else {
        // Daily logs: Generate TWO notifications using Gemini API
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

        if (!profile) {
          console.error('❌ No profile found for AI notification');
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
            type: 'success',
            priority: 2
          });
          console.log('✅ Positive AI notification created:', { success: !error });
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
          console.log('✅ Alert AI notification created:', { success: !error });
        }
      }

      fetchNotifications(userId);

    } catch (error) {
      console.error('Error analyzing with AI:', error);
    }
  };

  const fetchUserForms = async (userId: string) => {
    const { data, error } = await supabase.from('consultation_forms').select('*').eq('user_id', userId);
    if (error) {
      console.error('❌ Error fetching forms:', error);
      showNotif('Error cargando formularios: ' + error.message, 'error');
    }
    if (data) setSubmittedForms(data);
  };

  const fetchEducation = async (userId: string, methodStart?: string) => {
    const { data: modulesData } = await supabase.from('content_modules').select(`*, content_lessons (*)`).order('order_index');
    const { data: progressData } = await supabase.from('user_progress').select('lesson_id').eq('user_id', userId);
    const completedSet = new Set(progressData?.map(p => p.lesson_id) || []);

    let currentWeek = 0;
    if (methodStart) {
      const start = new Date(methodStart);
      start.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
      currentWeek = Math.ceil(days / 7) || 1;
    }

    if (modulesData) {
      setCourseModules(modulesData.map(m => ({
        id: m.id, title: m.title, description: m.description, order_index: m.order_index, phase: m.phase as any,
        lessons: m.content_lessons?.sort((a: any, b: any) => {
          if (a.type === 'video' && b.type !== 'video') return -1;
          if (a.type !== 'video' && b.type === 'video') return 1;
          return 0;
        }) || [],
        completedLessons: Array.from(completedSet).filter(id => m.content_lessons?.some((l: any) => l.id === id)) as number[],
        isCompleted: false,
        isLocked: m.phase > 0 && (!methodStart || m.order_index > currentWeek)
      })));
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
    const formattedLog = { ...todayLog, date: validDate };

    const { error } = await supabase.from('daily_logs').upsert(mapLogToDB(formattedLog as DailyLog, user.id), { onConflict: 'user_id, date' });
    if (!error) {
      showNotif("Registro guardado con éxito", 'success');
      await fetchLogs(user.id);

      // AI Notification Logic:
      // 1. First daily log ever -> Generate AI
      // 2. Every 7 days after first -> Generate AI
      const updatedLogs = await supabase.from('daily_logs').select('*').eq('user_id', user.id).order('date', { ascending: false });

      // RULE ENGINE EVALUATION
      // TODO: Implement DAILY_CHECK trigger in useEffect
      // const ruleNotifications = await evaluateRules('DAILY_LOG_SAVE', {
      //   user: user,
      //   currentLog: formattedLog as DailyLog,
      //   recentLogs: updatedLogs.data.map(mapLogFromDB)
      // });
      // await saveNotifications(user.id, ruleNotifications);
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
    const { error } = await supabase.from('user_progress').upsert({ user_id: user.id, lesson_id: lessonId }, { onConflict: 'user_id, lesson_id' });
    if (!error) {
      setCourseModules(prev => prev.map(m => ({
        ...m,
        completedLessons: m.lessons.some(l => l.id === lessonId) ? [...m.completedLessons, lessonId] : m.completedLessons
      })));
      showNotif("Lección completada", 'success');
      setActiveLesson(null);
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
      setTodayLog(existingLog);
    } else {
      // Auto-calculate cycle day
      // 1. Try to find the most recent log before this new date
      const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const prevLog = sortedLogs.find(l => new Date(l.date) < new Date(newDate));

      let newCycleDay = 1;

      if (prevLog) {
        const diff = Math.ceil((new Date(newDate).getTime() - new Date(prevLog.date).getTime()) / (1000 * 3600 * 24));
        newCycleDay = (prevLog.cycleDay || 0) + diff;
      } else {
        // 2. If no prev log, try to use F0 last period date
        const f0 = submittedForms.find(f => f.form_type === 'F0');
        if (f0 && f0.answers) {
          const lastPeriodAnswer = f0.answers.find((a: any) => a.questionId === 'q8_last_period');
          const cycleDurationAnswer = f0.answers.find((a: any) => a.questionId === 'q6_cycle');

          if (lastPeriodAnswer && lastPeriodAnswer.answer) {
            const lastPeriodDate = new Date(lastPeriodAnswer.answer as string);
            const cycleDuration = cycleDurationAnswer ? parseInt(cycleDurationAnswer.answer as string) : 28;

            const diff = Math.floor((new Date(newDate).getTime() - lastPeriodDate.getTime()) / (1000 * 3600 * 24));
            if (diff >= 0) {
              newCycleDay = (diff % cycleDuration) + 1;
            }
          }
        }
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
          <ProfileView
            user={user}
            logs={logs}
            submittedForms={submittedForms}
            reports={reports}
            scores={dashboardScores}
            visibleNotifications={visibleNotifications}
            profileTab={profileTab}
            setProfileTab={setProfileTab}
            isEditingProfile={isEditingProfile}
            setIsEditingProfile={setIsEditingProfile}
            editName={editName}
            setEditName={setEditName}
            onSaveProfile={handleSaveProfile}
            isEditingF0={isEditingF0}
            setIsEditingF0={setIsEditingF0}
            f0Answers={f0Answers}
            setF0Answers={setF0Answers}
            showNotif={showNotif}
            setView={setView}
            fetchUserForms={fetchUserForms}
            setUser={setUser}
            markNotificationRead={markNotificationRead}
            deleteNotification={deleteNotification}
            onNotificationAction={handleNotificationAction}
            onRestartMethod={handleRestartMethod}
            onLogout={handleLogout}
          />
        ) : (
          <div className="p-5">
            {view === 'DASHBOARD' && user && (
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
            )}
            {view === 'TRACKER' && (
              <TrackerView
                todayLog={todayLog}
                setTodayLog={setTodayLog}
                submittedForms={submittedForms}
                logs={logs}
                handleDateChange={handleDateChange}
                saveDailyLog={saveDailyLog}
                user={user}
                onUserUpdate={(updatedUser) => setUser(updatedUser)}
                showNotif={showNotif}
              />
            )}
            {view === 'EDUCATION' && (
              <EducationView
                courseModules={courseModules}
                onSelectLesson={setActiveLesson}
              />
            )}
            {view === 'CONSULTATIONS' && user && (
              <ConsultationsView
                user={user}
                logs={logs}
                submittedForms={submittedForms}
                showNotif={showNotif}
                fetchUserForms={fetchUserForms}
              />
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