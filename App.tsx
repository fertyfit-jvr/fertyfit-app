import React, { lazy, Suspense, useMemo, useEffect } from 'react';
import { Heart, Activity, BookOpen, FileText, User } from 'lucide-react';
import { BRAND_ASSETS } from './constants';
import { calculateDaysOnMethod } from './services/dataService';
import { useAppStore } from './store/useAppStore';
import { useAuth } from './hooks/useAuth';
import { useDailyNotifications } from './hooks/useDailyNotifications';
import { useUserDataLoader } from './hooks/useUserDataLoader';
import { useNotificationActions } from './hooks/useNotificationActions';
import Notification from './components/common/Notification';
import PhaseIntroModal from './components/common/PhaseIntroModal';
import NavButton from './components/common/NavButton';
import ViewLoading from './components/common/ViewLoading';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import LoginView from './views/Auth/LoginView';
import DisclaimerView from './views/Disclaimer/DisclaimerView';
import LessonModal from './components/Education/LessonModal';

// Lazy load views for better performance
const TrackerView = lazy(() => import('./views/Tracker/TrackerView'));
const DashboardView = lazy(() => import('./views/Dashboard/DashboardView'));
const EducationView = lazy(() => import('./views/Education/EducationView'));
const ConsultationsView = lazy(() => import('./views/Consultations/ConsultationsView'));
const ProfileView = lazy(() => import('./views/Profile/ProfileView'));

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
    notif, setNotif,
    courseModules,
    todayLog, setTodayLog,
    activeLesson, setActiveLesson,
    deletedNotificationIds,
    showNotif,
    handleRestartMethod,
    fetchAllLogs,
    fetchUserForms,
    markNotificationRead,
    deleteNotification,
    handleModalClose,
    handleDateChange,
    saveDailyLog,
    startMethod,
    acceptDisclaimer,
    markLessonComplete,
  } = useAppStore();

  const { checkUser, handleAuth: authHandleAuth, handleLogout } = useAuth();
  const { handleNotificationAction } = useNotificationActions();
  useDailyNotifications();
  useUserDataLoader();

  // Filter notifications
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const visibleNotifications = safeNotifications.filter(n => !deletedNotificationIds.includes(n.id));
  const unreadNotifications = visibleNotifications.filter(n => !n.is_read);

  // Check user session on mount
  useEffect(() => { 
    checkUser(); 
  }, []);

  // Handle authentication
  const handleAuth = async () => {
    setAuthError('');
    const success = await authHandleAuth(email, password, name, isSignUp);
    
    if (isSignUp && success) {
      showNotif("¡Registro exitoso! Revisa tu email.", 'success');
      setIsSignUp(false);
    }
  };

  // Calculate dashboard metrics
  const dashboardDaysActive = useMemo(() => calculateDaysOnMethod(user?.methodStartDate), [user?.methodStartDate]);
  const dashboardProgress = Math.min(100, dashboardDaysActive > 0 ? (dashboardDaysActive / 90) * 100 : 0);

  // Render active lesson modal
  if (activeLesson) {
    return (
      <LessonModal
        lesson={activeLesson}
        onClose={() => setActiveLesson(null)}
        onMarkComplete={markLessonComplete}
      />
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

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F0ED]">
        <div className="animate-pulse flex flex-col items-center">
          <img src={BRAND_ASSETS.favicon} alt="Loading" className="w-12 h-12 mb-4 animate-bounce" />
          <p className="text-[#C7958E] font-bold text-sm tracking-widest">CARGANDO...</p>
        </div>
      </div>
    );
  }

  // Auth/Onboarding view
  if (view === 'ONBOARDING' || !user) {
    return (
      <LoginView
        email={email}
        password={password}
        name={name}
        isSignUp={isSignUp}
        authError={authError}
        notif={notif}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onNameChange={setName}
        onToggleSignUp={() => setIsSignUp(!isSignUp)}
        onAuth={handleAuth}
        onCloseNotif={() => setNotif(null)}
      />
    );
  }

  // Disclaimer view
  if (view === 'DISCLAIMER') {
    return <DisclaimerView onAccept={acceptDisclaimer} />;
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
                    const currentUser = useAppStore.getState().user;
                    if (currentUser) {
                      setUser({ ...currentUser, ...updatedUser });
                    } else {
                      setUser(updatedUser);
                    }
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
          onClick={() => setView('TRACKER')}
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