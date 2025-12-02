import React, { Component, useEffect, ErrorInfo, ReactNode, lazy, Suspense, useState } from 'react';
import {
  Heart, Activity, BookOpen, FileText, User, AlertCircle,
  FileText as PdfIcon,
  X, Mail, Key, Download,
  CheckCircle
} from 'lucide-react';

import { AppNotification, NotificationAction } from './types';
import { BRAND_ASSETS } from './constants';
import { calculateDaysOnMethod, formatDateForDB } from './services/dataService';
import { handlePeriodConfirmed, handlePeriodDelayed } from './services/RuleEngine';
import { isValidNotificationHandler } from './types';
import { useAppStore } from './store/useAppStore';
import Notification from './components/common/Notification';
import PhaseIntroModal from './components/common/PhaseIntroModal';
import NavButton from './components/common/NavButton';
import { useAuth } from './hooks/useAuth';
import { useDailyNotifications } from './hooks/useDailyNotifications';
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
    loading,
    view, setView,
    user, setUser,
    logs, setLogs,
    dashboardScores,
    notifications,
    submittedForms,
    reports,
    showPhaseModal,
    currentPhase,
    email, setEmail,
    password, setPassword,
    name, setName,
    isSignUp, setIsSignUp,
    authError, setAuthError,
    notif,
    courseModules,
    todayLog, setTodayLog,
    activeLesson, setActiveLesson,
    deletedNotificationIds,
    // acciones de negocio desde el store
    showNotif,
    handleRestartMethod,
    fetchLogs,
    fetchAllLogs,
    fetchNotifications,
    fetchReports,
    fetchUserForms,
    fetchEducation,
    markNotificationRead,
    deleteNotification,
    handleModalClose,
    handleDateChange,
    saveDailyLog,
    startMethod,
    acceptDisclaimer,
    markLessonComplete,
  } = useAppStore();

  // Initialize hooks for auth and daily notifications
  const { checkUser, handleAuth: authHandleAuth, handleLogout, refreshUserProfile } = useAuth();
  useDailyNotifications();

  // Filter notifications based on blacklist
  // Ensure notifications is always an array
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const visibleNotifications = safeNotifications.filter(n => !deletedNotificationIds.includes(n.id));
  const unreadNotifications = visibleNotifications.filter(n => !n.is_read);

  const dashboardDaysActive = calculateDaysOnMethod(user?.methodStartDate);
  const dashboardProgress = Math.min(100, dashboardDaysActive > 0 ? (dashboardDaysActive / 90) * 100 : 0);

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
        
        // Load reports only for admins
        const currentUser = useAppStore.getState().user;
        if (currentUser && currentUser.role === 'admin') {
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
                    // Preservar todos los campos del usuario actual al actualizar
                    // Esto asegura que methodStartDate y otros campos estáticos no se pierdan
                    setUser(prevUser => prevUser ? { ...prevUser, ...updatedUser } : updatedUser);
                    // Solo refrescar formularios - los datos del perfil ya vienen actualizados desde TrackerView
                    // Esto evita una query redundante a Supabase (optimización)
                    if (updatedUser?.id) {
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