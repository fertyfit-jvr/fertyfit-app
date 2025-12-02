import { useMemo, useEffect, useRef, useState } from 'react';
import { Award, Check, Edit2, FileText, LogOut, AlertCircle, X, Download, Loader2 } from 'lucide-react';
import { AppNotification, ConsultationForm, DailyLog, UserProfile, AdminReport, NotificationAction, ViewState } from '../../types';
import { FORM_DEFINITIONS } from '../../constants/formDefinitions';
import { NotificationList } from '../../components/NotificationSystem';
import ReportCard from '../../components/common/ReportCard';
import { generarDatosInformeMedico } from '../../services/MedicalReportHelpers';
import { calcularDiaDelCiclo, calcularFechaInicioCicloActual } from '../../services/CycleCalculations';
import { updateConsultationFormById, updateProfileForUser } from '../../services/userDataService';
import { formatDate } from '../../services/utils';
import { calculateDaysOnMethod, calculateCurrentWeek } from '../../services/dataService';
import { calculateCurrentMonthsTrying, setTimeTryingStart } from '../../services/timeTryingService';

interface ProfileHeaderProps {
  user: UserProfile;
  logs: DailyLog[];
  logsCount: number;
  scores: { total: number; function: number; food: number; flora: number; flow: number };
  submittedForms: ConsultationForm[];
}

const ProfileHeader = ({ user, logs, logsCount, scores, submittedForms }: ProfileHeaderProps) => {
  const daysActive = useMemo(() => {
    return calculateDaysOnMethod(user.methodStartDate);
  }, [user.methodStartDate]);

  const level = logsCount > 30 ? 'Experta' : logsCount > 7 ? 'Comprometida' : 'Iniciada';
  const currentWeek = calculateCurrentWeek(daysActive);

  // Calculate months trying dynamically using new service
  const monthsTrying = useMemo(() => {
    if (!user.timeTryingStartDate) return null;
    return calculateCurrentMonthsTrying(user.timeTryingStartDate, user.timeTryingInitialMonths || 0);
  }, [user.timeTryingStartDate, user.timeTryingInitialMonths]);

  return (
    <div className="bg-gradient-to-br from-[#C7958E] to-[#95706B] pt-10 pb-8 px-6 rounded-b-[2.5rem] shadow-lg mb-6 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-5 mb-3">
          <div className="w-18 h-18 bg-white text-[#C7958E] rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white/20 shadow-inner">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{user.name}</h2>
            <div className="flex items-center gap-1 text-rose-50 bg-black/10 px-3 py-1 rounded-full w-fit mt-1 backdrop-blur-sm">
              <Award size={12} />
              <span className="text-xs font-medium">Nivel {level}</span>
            </div>
          </div>
        </div>
        <div className="mb-4 text-sm text-white/90 ml-1">
          <p className="flex items-center gap-2">
            <span className="opacity-75">Días Método:</span>
            <span className="font-semibold">{daysActive}</span>
            <span className="opacity-50">•</span>
            <span className="opacity-75">Registros:</span>
            <span className="font-semibold">{logsCount}</span>
            <span className="opacity-50">•</span>
            <span className="opacity-75">Semana:</span>
            <span className="font-semibold">{currentWeek}</span>
          </p>
          {monthsTrying !== null && (
            <p className="text-[11px] opacity-75 mt-1">
              Buscando embarazo desde hace <span className="font-semibold">{monthsTrying}</span> meses
            </p>
          )}
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-75 mb-1">Ferty Score</p>
              <p className="text-3xl font-bold">{scores.total}<span className="text-lg opacity-75">/100</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-75 mb-1">Pilares</p>
              <div className="flex gap-3 text-[10px]">
                {(['function', 'food', 'flora', 'flow'] as const).map(key => (
                  <div key={key} className="flex flex-col items-center">
                    <span className="font-bold text-lg">{(scores as any)[key]}</span>
                    <span className="opacity-75">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProfileViewProps {
  user: UserProfile;
  logs: DailyLog[];
  submittedForms: ConsultationForm[];
  reports: AdminReport[];
  scores: { total: number; function: number; food: number; flora: number; flow: number };
  visibleNotifications: AppNotification[];
  showNotif: (msg: string, type: 'success' | 'error') => void;
  setView: (view: ViewState) => void;
  fetchUserForms: (userId: string) => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  fetchAllLogs?: (userId: string) => Promise<DailyLog[]>;
  setLogs?: (logs: DailyLog[]) => void;
  markNotificationRead: (id: number) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  onNotificationAction: (notification: AppNotification, action: NotificationAction) => Promise<void>;
  onRestartMethod: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const ProfileView = ({
  user,
  logs,
  submittedForms,
  reports,
  scores,
  visibleNotifications,
  showNotif,
  setView,
  fetchUserForms,
  setUser,
  markNotificationRead,
  deleteNotification,
  onNotificationAction,
  onRestartMethod,
  onLogout,
  fetchAllLogs,
  setLogs
}: ProfileViewProps) => {
  // Estados locales - ya no están en el store global
  const [profileTab, setProfileTab] = useState<'PROFILE' | 'HISTORIA'>('PROFILE');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [isEditingF0, setIsEditingF0] = useState(false);
  const [f0Answers, setF0Answers] = useState<Record<string, any>>({});
  
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedAllHistory, setHasLoadedAllHistory] = useState(false);
  
  // Guardar valores originales para poder cancelar
  const originalEditName = useRef<string>(user.name);
  const originalF0Answers = useRef<Record<string, any>>({});
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sincronizar editName cuando cambie el usuario
  useEffect(() => {
    setEditName(user.name);
    originalEditName.current = user.name;
  }, [user.name]);

  // Función local para guardar perfil
  const handleSaveProfile = async () => {
    if (!user?.id) return;

    try {
      await updateProfileForUser(user.id, { name: editName });
      setUser({ ...user, name: editName });
      setIsEditingProfile(false);
      showNotif('Perfil actualizado correctamente', 'success');
    } catch {
      showNotif('Error al actualizar perfil', 'error');
    }
  };

  const handleProfileEditClick = () => {
    if (isEditingProfile) {
      handleSaveProfile();
    } else {
      originalEditName.current = user.name;
      setIsEditingProfile(true);
    }
  };

  const handleProfileCancel = () => {
    setEditName(originalEditName.current);
    setIsEditingProfile(false);
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  };

  const handleRestartClick = async () => {
    const confirmed = confirm('¿Estás segura de que deseas reiniciar el método?');
    if (!confirmed) return;
    await onRestartMethod();
  };

  const handleLoadFullHistory = async () => {
    if (!user?.id || !fetchAllLogs || !setLogs) return;
    
    setIsLoadingHistory(true);
    try {
      const allLogs = await fetchAllLogs(user.id);
      setLogs(allLogs);
      setHasLoadedAllHistory(true);
      showNotif(`Historial completo cargado: ${allLogs.length} registros`, 'success');
    } catch (error) {
      showNotif('Error al cargar historial completo', 'error');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Check if we should show "Load full history" button
  // Show if logs.length is exactly 90 (default limit) and we haven't loaded all history yet
  const shouldShowLoadHistoryButton = useMemo(() => {
    return logs.length >= 90 && !hasLoadedAllHistory && fetchAllLogs && setLogs;
  }, [logs.length, hasLoadedAllHistory, fetchAllLogs, setLogs]);

  const handleF0Save = async (f0Form: ConsultationForm) => {
    if (!user?.id) return;

    const formattedAnswers = FORM_DEFINITIONS.F0.questions.map(q => ({
      questionId: q.id,
      question: q.text,
      answer: f0Answers[q.id] || ''
    }));

    try {
      await updateConsultationFormById(f0Form.id, {
        answers: formattedAnswers,
        status: 'pending'
      });
    } catch (error: any) {
      showNotif(error?.message || 'Error al guardar F0', 'error');
      return;
    }

    const updates: Partial<UserProfile> = {};
    if (f0Answers['q2_weight']) updates.weight = parseFloat(f0Answers['q2_weight']);
    if (f0Answers['q2_height']) updates.height = parseFloat(f0Answers['q2_height']);
    if (f0Answers['q4_objective']) updates.mainObjective = f0Answers['q4_objective'];
    // Nota: lastPeriodDate ya no se guarda en F0, se maneja desde TrackerView
    if (f0Answers['q6_cycle']) updates.cycleLength = parseFloat(f0Answers['q6_cycle']) || parseInt(f0Answers['q6_cycle']);

    // Set time_trying fields if q3_time_trying is present
    if (f0Answers['q3_time_trying']) {
      const initialMonths = parseInt(String(f0Answers['q3_time_trying']).replace(/\D/g, '')) || 0;
      const submissionDate = f0Form.submitted_at || new Date().toISOString();
      const startDate = submissionDate.split('T')[0]; // Get YYYY-MM-DD format
      
      const success = await setTimeTryingStart(user.id, initialMonths, startDate);
      if (success) {
        updates.timeTryingStartDate = startDate;
        updates.timeTryingInitialMonths = initialMonths;
        updates.timeTrying = calculateCurrentMonthsTrying(startDate, initialMonths) || undefined;
      }
    }

    if (Object.keys(updates).length > 0) {
      const profileUpdates: any = {};
      if (updates.weight !== undefined) profileUpdates.weight = updates.weight;
      if (updates.height !== undefined) profileUpdates.height = updates.height;
      if (updates.mainObjective !== undefined) profileUpdates.main_objective = updates.mainObjective;
      if (updates.cycleLength !== undefined) profileUpdates.cycle_length = updates.cycleLength;
      
      await updateProfileForUser(user.id, profileUpdates);
      setUser({ ...user, ...updates });
    }

    showNotif('Ficha Personal actualizada correctamente', 'success');
    setIsEditingF0(false);
    fetchUserForms(user.id);
  };

  // Calcular si debería haber venido la regla
  const shouldUpdatePeriod = useMemo(() => {
    if (!user?.lastPeriodDate || !user?.cycleLength) return false;
    const currentCycleDay = calcularDiaDelCiclo(user.lastPeriodDate, user.cycleLength);
    return currentCycleDay >= user.cycleLength;
  }, [user?.lastPeriodDate, user?.cycleLength]);

  const daysOverdue = useMemo(() => {
    if (!user?.lastPeriodDate || !user?.cycleLength) return 0;
    const currentCycleDay = calcularDiaDelCiclo(user.lastPeriodDate, user.cycleLength);
    return Math.max(0, currentCycleDay - user.cycleLength);
  }, [user?.lastPeriodDate, user?.cycleLength]);

  // Sincronizar f0Answers cuando user o submittedForms cambien (solo si no está editando)
  useEffect(() => {
    if (isEditingF0) return; // No sincronizar si está editando para no perder cambios del usuario
    
    const f0Form = submittedForms.find(f => f.form_type === 'F0');
    if (f0Form && f0Form.answers) {
      const syncedAnswers: Record<string, any> = {};
      f0Form.answers.forEach((a: any) => { 
        syncedAnswers[a.questionId] = a.answer; 
      });
      
      // Si user.cycleLength cambió, actualizar también en f0Answers
      // Nota: lastPeriodDate ya no se sincroniza con F0, se maneja desde TrackerView
      if (user?.cycleLength && syncedAnswers['q6_cycle'] !== user.cycleLength) {
        syncedAnswers['q6_cycle'] = user.cycleLength;
      }
      
      setF0Answers(syncedAnswers);
    }
  }, [user?.lastPeriodDate, user?.cycleLength, submittedForms, isEditingF0]);

  // Guardado automático después de 5 minutos de inactividad para F0
  // El timer se resetea automáticamente cada vez que el usuario escribe (debounce)
  useEffect(() => {
    if (!isEditingF0) return;

    // Limpiar timeout anterior (esto crea el efecto debounce)
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Guardar automáticamente después de 5 minutos de inactividad
    autoSaveTimeoutRef.current = setTimeout(() => {
      const f0Form = submittedForms.find(f => f.form_type === 'F0');
      if (f0Form && user?.id) {
        // Llamar handleF0Save directamente sin dependencias circulares
        handleF0Save(f0Form);
      }
    }, 300000); // 5 minutos = 300000ms

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f0Answers, isEditingF0, submittedForms, user?.id]);

  // Advertencia al cambiar de pestaña sin guardar
  useEffect(() => {
    const handleTabChange = (e: BeforeUnloadEvent) => {
      if (isEditingProfile || isEditingF0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleTabChange);
    return () => window.removeEventListener('beforeunload', handleTabChange);
  }, [isEditingProfile, isEditingF0]);

  return (
    <div className="pb-24">
      <ProfileHeader
        user={user}
        logs={logs}
        logsCount={logs.length}
        scores={scores}
        submittedForms={submittedForms}
      />

      <div className="p-5 pt-0">
        <div className="flex gap-2 mb-6 bg-white p-1 rounded-2xl shadow-sm">
          <button
            onClick={() => setProfileTab('PROFILE')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${profileTab === 'PROFILE'
              ? 'bg-[#C7958E] text-white shadow-md'
              : 'text-[#5D7180] hover:bg-[#F4F0ED]'}`}
          >
            Mi Perfil
          </button>
          <button
            onClick={() => setProfileTab('HISTORIA')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${profileTab === 'HISTORIA'
              ? 'bg-[#C7958E] text-white shadow-md'
              : 'text-[#5D7180] hover:bg-[#F4F0ED]'}`}
          >
            Historia
          </button>
        </div>

        {profileTab === 'PROFILE' && (() => {
          const medicalData = generarDatosInformeMedico(user, logs);
          
          return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="font-bold text-[#4A4A4A] text-sm">Datos Personales</h3>
                  <p className="text-[10px] text-[#5D7180] mt-0.5">
                    Miembro desde: {new Date(user.joinedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                  <div className="flex items-center gap-2">
                    {isEditingProfile && (
                      <button
                        onClick={handleProfileCancel}
                        className="text-[#95706B] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                        title="Cancelar"
                      >
                        <X size={16} />
                      </button>
                    )}
                <button
                  onClick={handleProfileEditClick}
                  className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                      title={isEditingProfile ? "Guardar" : "Editar"}
                >
                  {isEditingProfile ? <Check size={16} /> : <Edit2 size={16} />}
                </button>
                  </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F4F0ED] space-y-4">
                <div className="border-b border-[#F4F0ED] pb-3">
                  <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Nombre</p>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full text-sm text-[#4A4A4A] border-b border-[#C7958E] focus:outline-none py-1"
                    />
                  ) : (
                    <p className="text-sm text-[#4A4A4A]">{user.name}</p>
                  )}
                </div>
                <div className="border-b border-[#F4F0ED] pb-3">
                  <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Email</p>
                  <p className="text-sm text-[#4A4A4A] opacity-70">{user.email} <span className="text-[10px] italic">(No editable)</span></p>
                  </div>
                  
                  {/* Salud General */}
                  {medicalData && (
                    <>
                      <div className="border-b border-[#F4F0ED] pb-3">
                        <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-2">Salud General</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-[#5D7180] mb-0.5">Edad</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.edad} años</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D7180] mb-0.5">IMC</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.imc.valor} ({medicalData.imc.categoria})</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D7180] mb-0.5">Peso actual</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.pesoActual} kg</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D7180] mb-0.5">Peso ideal</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.pesoIdeal.minimo}-{medicalData.pesoIdeal.maximo} kg</p>
                          </div>
                        </div>
                      </div>

                      {/* Hábitos (últimos 7 días) */}
                      <div className="border-b border-[#F4F0ED] pb-3">
                        <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-2">Hábitos (últimos 7 días)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-[#5D7180] mb-0.5">Sueño</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.promedios.sueno}h</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D7180] mb-0.5">Estrés</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.promedios.estres}/5</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D7180] mb-0.5">Agua</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.promedios.agua} vasos</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D7180] mb-0.5">Vegetales</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.promedios.vegetales} porcs</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] text-[#5D7180] mb-0.5">Días con alcohol</p>
                            <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.promedios.diasConAlcohol}</p>
                          </div>
                        </div>
                      </div>

                      {/* Análisis de Edad */}
                      <div>
                        <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-2">Análisis de Edad</p>
                        <p className="text-sm font-semibold text-[#4A4A4A] mb-1">{medicalData.analisisEdad.categoria} - {medicalData.analisisEdad.probabilidad}</p>
                        <p className="text-[10px] text-[#5D7180]">{medicalData.analisisEdad.mensaje}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

            {shouldShowLoadHistoryButton && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-blue-800 mb-1">
                      Historial limitado a últimos 90 días
                    </p>
                    <p className="text-xs text-blue-600">
                      Tienes más registros disponibles. Carga el historial completo para ver todos tus datos.
                    </p>
                  </div>
                  <button
                    onClick={handleLoadFullHistory}
                    disabled={isLoadingHistory}
                    className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                  >
                    {isLoadingHistory ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Cargar todo
                      </>
                    )}
                  </button>
              </div>
            </div>
            )}

            <div>
              <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Mis Informes</h3>
              {reports.length > 0 ? (
                <div className="space-y-3">
                  {reports.map(report => (
                    <ReportCard key={report.id} report={report} />
                  ))}
                </div>
              ) : (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-stone-200 text-center text-stone-400 text-xs italic">
                  Aún no tienes informes disponibles
                </div>
              )}
            </div>

            <div>
              <NotificationList
                notifications={visibleNotifications}
                onMarkRead={markNotificationRead}
                deleteNotification={deleteNotification}
                onAction={onNotificationAction}
              />
            </div>

            {user.methodStartDate && (
              <button
                onClick={handleRestartClick}
                className="w-full py-2 text-xs text-stone-400 hover:text-[#C7958E] transition-colors underline"
              >
                Reiniciar Método
              </button>
            )}

            <button
              onClick={onLogout}
              className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors border border-rose-100"
            >
              <LogOut size={20} />
              Cerrar Sesión
            </button>
          </div>
          );
        })()}

        {profileTab === 'HISTORIA' && (() => {
          const f0Form = submittedForms.find(f => f.form_type === 'F0');
          if (!f0Form) {
            return (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-stone-200 text-center">
                <FileText size={48} className="mx-auto text-stone-300 mb-4" />
                <p className="text-stone-400 text-sm">Aún no has completado el formulario F0</p>
                <button
                  onClick={() => setView('CONSULTATIONS')}
                  className="mt-4 bg-[#C7958E] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#95706B] transition-colors"
                >
                  Completar F0
                </button>
              </div>
            );
          }

          // formatDate is now imported from services/utils

          const handleEditF0Click = () => {
            // Buscar el f0Form más reciente en el momento del clic (no en el render)
            const currentF0Form = submittedForms.find(f => f.form_type === 'F0');
            if (!currentF0Form) return;
            
            const initialAnswers: Record<string, any> = {};
            currentF0Form.answers.forEach((a: any) => { 
              initialAnswers[a.questionId] = a.answer; 
            });
            
            // Actualizar cycleLength si está disponible en user
            // Nota: lastPeriodDate ya no se edita desde F0, se maneja desde TrackerView
            if (user?.cycleLength) {
              initialAnswers['q6_cycle'] = user.cycleLength;
            }
            
            originalF0Answers.current = JSON.parse(JSON.stringify(initialAnswers)); // Deep copy
            setF0Answers(initialAnswers);
            setIsEditingF0(true);
          };

          const handleF0Cancel = () => {
            setF0Answers(JSON.parse(JSON.stringify(originalF0Answers.current))); // Restore original
            setIsEditingF0(false);
            if (autoSaveTimeoutRef.current) {
              clearTimeout(autoSaveTimeoutRef.current);
              autoSaveTimeoutRef.current = null;
            }
          };

          return (
            <div className="space-y-4">
              {/* Notificación discreta si debería actualizar la regla */}
              {shouldUpdatePeriod && !isEditingF0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                  <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-amber-800 mb-1">
                      Actualiza tu ciclo menstrual
                    </p>
                    <p className="text-[10px] text-amber-700">
                      {daysOverdue === 0 
                        ? 'Tu ciclo ha concluido. ¿Te ha venido la regla?'
                        : `Tu ciclo concluyó hace ${daysOverdue} día${daysOverdue > 1 ? 's' : ''}. Actualiza la fecha para mantener tus predicciones precisas.`
                      }
                    </p>
                    <button
                      onClick={() => {
                        // Navegar a TrackerView para actualizar el ciclo menstrual
                        // La fecha de última regla se actualiza desde el registro diario
                        setView('TRACKER');
                      }}
                      className="mt-2 text-[10px] font-bold text-amber-700 hover:text-amber-900 underline"
                    >
                      Actualizar ahora →
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="font-bold text-[#4A4A4A] text-sm">Ficha Personal (F0)</h3>
                  <p className="text-[10px] text-[#5D7180] mt-0.5">
                    Registrado: {formatDate(f0Form.submitted_at || new Date().toISOString(), 'long')}
                  </p>
                  {f0Form.pdf_generated_at && (
                    <p className="text-[10px] text-[#5D7180] mt-0.5">
                      Última actualización: {formatDate(f0Form.pdf_generated_at, 'long')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditingF0 && (
                    <button
                      onClick={handleF0Cancel}
                      className="text-[#95706B] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                      title="Cancelar"
                    >
                      <X size={16} />
                    </button>
                  )}
                <button
                  onClick={() => {
                    if (isEditingF0) {
                      handleF0Save(f0Form);
                    } else {
                      handleEditF0Click();
                    }
                  }}
                  className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                    title={isEditingF0 ? "Guardar" : "Editar"}
                >
                  {isEditingF0 ? <Check size={16} /> : <Edit2 size={16} />}
                </button>
                </div>
              </div>

              {isEditingF0 ? (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
                  <h3 className="font-bold text-lg text-[#C7958E] mb-1">{FORM_DEFINITIONS.F0.title}</h3>
                  <p className="text-xs text-[#5D7180] mb-6 border-b border-[#F4F0ED] pb-4">{FORM_DEFINITIONS.F0.description}</p>
                  <div className="space-y-6">
                    {FORM_DEFINITIONS.F0.questions.map(q => {
                      const updateAnswer = (id: string, value: any) => {
                        setF0Answers({ ...f0Answers, [id]: value });
                      };

                      const renderNumberControl = (question: any) => {
                        const step = question.step ?? 1;
                        const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
                        const rawValue = f0Answers[question.id];
                        const numericValue =
                          typeof rawValue === 'number'
                            ? rawValue
                            : rawValue !== undefined && rawValue !== ''
                            ? Number(rawValue)
                            : undefined;

                        const clampValue = (value: number) => {
                          let next = value;
                          if (typeof question.min === 'number') next = Math.max(question.min, next);
                          if (typeof question.max === 'number') next = Math.min(question.max, next);
                          const precision = decimals > 2 ? 2 : decimals;
                          return Number(next.toFixed(precision));
                        };

                        const handleAdjust = (direction: 1 | -1) => {
                          const base = numericValue ?? question.defaultValue ?? question.min ?? 0;
                          const adjusted = clampValue(base + direction * step);
                          updateAnswer(question.id, adjusted);
                        };

                        return (
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleAdjust(-1)} className="w-10 h-10 rounded-2xl border border-[#E1D7D3] text-[#95706B] font-bold text-lg bg-white hover:bg-[#F4F0ED]" type="button">
                              -
                            </button>
                            <div className="flex-1 text-center bg-[#F9F6F4] border border-[#F4F0ED] rounded-2xl py-2">
                              <p className="text-lg font-bold text-[#4A4A4A]">{numericValue !== undefined && !Number.isNaN(numericValue) ? numericValue : '—'}</p>
                              {question.unit && <p className="text-[11px] text-[#95706B] font-semibold">{question.unit}</p>}
                            </div>
                            <button onClick={() => handleAdjust(1)} className="w-10 h-10 rounded-2xl border border-[#E1D7D3] text-[#95706B] font-bold text-lg bg-white hover:bg-[#F4F0ED]" type="button">
                              +
                            </button>
                          </div>
                        );
                      };

                      const renderSliderControl = (question: any) => {
                        const min = question.min ?? 0;
                        const max = question.max ?? 100;
                        const step = question.step ?? 1;
                        const rawValue = f0Answers[question.id];
                        const currentValue =
                          typeof rawValue === 'number'
                            ? rawValue
                            : rawValue !== undefined && rawValue !== ''
                            ? Number(rawValue)
                            : question.defaultValue ?? min;
                        const safeValue = Number.isFinite(currentValue) ? currentValue : min;

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#95706B]">
                              <span>
                                {safeValue}
                                {question.unit ? ` ${question.unit}` : ''}
                              </span>
                              <span className="text-[#BBA49E]">
                                {min}
                                {question.unit ? ` ${question.unit}` : ''} – {max}
                                {question.unit ? ` ${question.unit}` : ''}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step={step}
                              value={safeValue}
                              className="w-full accent-[#C7958E]"
                              onChange={event => updateAnswer(question.id, Number(event.target.value))}
                            />
                          </div>
                        );
                      };

                      const renderSegmentedControl = (question: any) => {
                        const min = question.min ?? 1;
                        const max = question.max ?? 5;
                        const values = question.options || Array.from({ length: max - min + 1 }, (_, index) => min + index);
                        return (
                          <div className="flex flex-wrap gap-2">
                            {values.map((option: any) => {
                              const optionValue = option;
                              const isActive = f0Answers[question.id] === optionValue;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => updateAnswer(question.id, optionValue)}
                                  className={`px-3 py-2 text-xs font-bold rounded-full border transition-all ${
                                    isActive ? 'bg-[#C7958E] text-white border-[#C7958E]' : 'text-[#5D7180] border-[#E1D7D3] hover:bg-[#F4F0ED]'
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        );
                      };

                      const renderButtons = (question: any, options: string[]) => (
                        <div className="flex flex-wrap gap-2">
                          {options.map(option => {
                            const isActive = f0Answers[question.id] === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => updateAnswer(question.id, option)}
                                className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all ${
                                  isActive ? 'bg-[#C7958E] text-white border-[#C7958E]' : 'text-[#5D7180] border-[#E1D7D3] hover:bg-[#F4F0ED]'
                                }`}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      );

                      const controlType = (q as any).control ?? q.type;

                      return (
                        <div key={q.id}>
                          <label className="block text-xs font-bold text-[#4A4A4A] mb-2 uppercase tracking-wide">{q.text}</label>
                          {q.type === 'textarea' ? (
                            <textarea
                              value={f0Answers[q.id] || ''}
                              className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm h-28 bg-[#F4F0ED]/30 focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E] outline-none transition-all"
                              onChange={e => updateAnswer(q.id, e.target.value)}
                            />
                          ) : q.type === 'yesno' ? (
                            renderButtons(q, ['Sí', 'No'])
                          ) : q.type === 'buttons' && Array.isArray(q.options) ? (
                            renderButtons(q, q.options)
                          ) : q.type === 'segmented' ? (
                            renderSegmentedControl(q)
                          ) : q.type === 'date' ? (
                            <input
                              type="date"
                              value={f0Answers[q.id] || ''}
                              className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-[#F4F0ED]/30 focus:border-[#C7958E] outline-none transition-all"
                              onChange={e => updateAnswer(q.id, e.target.value)}
                            />
                          ) : controlType === 'slider' || q.type === 'slider' ? (
                            renderSliderControl(q)
                          ) : controlType === 'stepper' || q.type === 'stepper' ? (
                            renderNumberControl(q)
                          ) : (
                            <input
                              type={q.type === 'number' ? 'number' : 'text'}
                              value={f0Answers[q.id] || ''}
                              className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-[#F4F0ED]/30 focus:border-[#C7958E] outline-none transition-all"
                              onChange={e => updateAnswer(q.id, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handleF0Save(f0Form)}
                    className="w-full bg-[#5D7180] text-white py-4 rounded-xl font-bold shadow-lg mt-8 hover:bg-[#4A5568] transition-all flex items-center justify-center gap-2"
                  >
                    Guardar cambios
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F4F0ED]">
                  {/* Campos en dos columnas: Altura/Peso, Nivel estrés/Horas sueño, Consumo alcohol */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {['q2_height', 'q2_weight', 'q15_stress', 'q16_sleep', 'q18_alcohol'].map(questionId => {
                      const answer = f0Form.answers.find(a => a.questionId === questionId);
                      if (!answer) return null;
                      const question = FORM_DEFINITIONS.F0.questions.find(q => q.id === answer.questionId);
                      if (!question) return null;

                      let displayValue = answer.answer;
                      
                      if (question.type === 'date' && typeof displayValue === 'string') {
                        displayValue = formatDate(displayValue, 'long');
                      }
                      
                      if (Array.isArray(displayValue)) {
                        displayValue = displayValue.join(', ');
                      }

                      // Formatear valores numéricos con unidades
                      if (questionId === 'q2_height' && typeof displayValue === 'number') {
                        displayValue = `${displayValue} cm`;
                      } else if (questionId === 'q2_weight' && typeof displayValue === 'number') {
                        displayValue = `${displayValue} kg`;
                      } else if (questionId === 'q16_sleep' && typeof displayValue === 'number') {
                        displayValue = `${displayValue} h`;
                      }

                      return (
                        <div key={questionId} className="border-b border-[#F4F0ED] pb-3">
                          <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">{question.text}</p>
                          <p className="text-sm text-[#4A4A4A]">{displayValue || '-'}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resto de campos en una columna */}
                  <div className="space-y-4">
                    {f0Form.answers
                      .filter(answer => !['q2_height', 'q2_weight', 'q15_stress', 'q16_sleep', 'q18_alcohol'].includes(answer.questionId))
                      .map((answer, idx) => {
                        const question = FORM_DEFINITIONS.F0.questions.find(q => q.id === answer.questionId);
                        if (!question) return null;

                        let displayValue = answer.answer;
                        
                        // Special handling for "Tiempo buscando embarazo" - show calculated value
                        if (answer.questionId === 'q3_time_trying') {
                          const initialMonths = parseInt(answer.answer as string);
                          if (!isNaN(initialMonths) && f0Form.submitted_at) {
                            const submittedDate = new Date(f0Form.submitted_at);
                            if (!isNaN(submittedDate.getTime())) {
                              const today = new Date();
                              const monthsDiff = (today.getFullYear() - submittedDate.getFullYear()) * 12 + 
                                               (today.getMonth() - submittedDate.getMonth());
                              displayValue = `${initialMonths + monthsDiff} meses`;
                            }
                          }
                        } else if (question.type === 'date' && typeof displayValue === 'string') {
                          displayValue = formatDate(displayValue, 'long');
                        }
                        
                        if (Array.isArray(displayValue)) {
                          displayValue = displayValue.join(', ');
                        }

                        return (
                          <div key={answer.questionId} className="border-b border-[#F4F0ED] pb-3 last:border-0">
                            <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">{question.text}</p>
                            <p className="text-sm text-[#4A4A4A] whitespace-pre-line">{displayValue || '-'}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ProfileView;

