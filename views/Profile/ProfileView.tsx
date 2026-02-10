import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Award, Check, Edit2, FileText, LogOut, AlertCircle, X, Download, Loader2, ChevronDown, ChevronUp, CheckCircle, Smile, Meh, Frown, Angry, XCircle, Heart } from 'lucide-react';
import { AppNotification, ConsultationForm, DailyLog, UserProfile, NotificationAction, ViewState, FormAnswer } from '../../types';

// Type for form answers dictionary (questionId -> answer value)
type FormAnswersDict = Record<string, string | number | boolean | string[] | undefined>;

// Type for form question (simplified, matches structure from formDefinitions)
type FormQuestion = {
  id: string;
  text: string;
  type?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: string | number | boolean | string[];
  optional?: boolean;
  control?: string;
  options?: string[];
  [key: string]: unknown; // For other dynamic properties
};
// import { ReportsList } from '../../components/ReportsList'; // Componente no disponible en esta versión
import { generarDatosInformeMedico } from '../../services/MedicalReportHelpers';
import { calcularDiaDelCiclo } from '../../services/CycleCalculations';
import { formatDate } from '../../services/utils';
import { useMethodProgress } from '../../hooks/useMethodProgress';
import { calculateCurrentMonthsTrying, setTimeTryingStart } from '../../services/timeTryingService';
import { calculateAgeFromBirthdate } from '../../services/dateUtils';
import { FORM_DEFINITIONS } from '../../constants/formDefinitions';
import { NotificationList } from '../../components/NotificationSystem';
import { updateConsultationFormById, updateProfileForUser } from '../../services/userDataService';
import { supabase } from '../../services/supabase';
import { PILLAR_ICONS } from '../../constants/api';
import { savePillarForm } from '../../services/pillarService';
import { ExamScanner } from '../../components/forms/ExamScanner';
import ProgressBar from '../../components/common/ProgressBar';

interface ProfileHeaderProps {
  user: UserProfile;
  logs: DailyLog[];
  logsCount: number;
  scores: { total: number; function: number; food: number; flora: number; flow: number };
  submittedForms: ConsultationForm[];
}

const ProfileHeader = React.memo(({ user, logs, logsCount, scores, submittedForms }: ProfileHeaderProps) => {
  // Calcular día y semana usando hook compartido (consistente con DashboardView)
  const { displayDay, displayWeek, isStarted, isCompleted } = useMethodProgress(user.methodStartDate);

  const level = logsCount > 30 ? 'Experta' : logsCount > 7 ? 'Comprometida' : 'Iniciada';

  // Calculate months trying dynamically using new service
  const monthsTrying = useMemo(() => {
    if (!user.timeTryingStartDate) return null;
    return calculateCurrentMonthsTrying(user.timeTryingStartDate, user.timeTryingInitialMonths || 0);
  }, [user.timeTryingStartDate, user.timeTryingInitialMonths]);

  return (
    <div className="bg-gradient-to-br from-ferty-rose to-ferty-coral pt-10 pb-8 px-6 rounded-b-[2.5rem] shadow-lg mb-6 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-5 mb-3">
          <div className="w-18 h-18 bg-white text-ferty-rose rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white/20 shadow-inner">
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
            {isStarted ? (
              <>
                <span className="opacity-75">Día:</span>
                <span className="font-semibold">{displayDay}</span>
                <span className="opacity-50">•</span>
                <span className="opacity-75">Semana:</span>
                <span className="font-semibold">{displayWeek}</span>
                <span className="opacity-50">•</span>
                <span className="opacity-75">Registros:</span>
                <span className="font-semibold">{logsCount}</span>
              </>
            ) : (
              <>
                <span className="opacity-75">Método:</span>
                <span className="font-semibold">No iniciado</span>
                <span className="opacity-50">•</span>
                <span className="opacity-75">Registros:</span>
                <span className="font-semibold">{logsCount}</span>
              </>
            )}
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
                    <span className="font-bold text-lg">{scores[key]}</span>
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
});

interface ProfileViewProps {
  user: UserProfile;
  logs: DailyLog[];
  submittedForms: ConsultationForm[];
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedAllHistory, setHasLoadedAllHistory] = useState(false);

  // Variables de estado para F0
  const [f0Answers, setF0Answers] = useState<FormAnswersDict>({});
  const [isEditingF0, setIsEditingF0] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');

  // Variables de estado para pilares
  const [formType, setFormType] = useState<PillarFormType>('FUNCTION');
  const [answers, setAnswers] = useState<FormAnswersDict>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Variables de estado para tabs y UI
  const [profileTab, setProfileTab] = useState<'HISTORIA' | 'PILARES'>('HISTORIA');
  const [isF0Expanded, setIsF0Expanded] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [pillarScannerOpen, setPillarScannerOpen] = useState(false);
  const [pillarExamType, setPillarExamType] = useState<'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio' | 'other'>('other');
  const [pillarExamName, setPillarExamName] = useState('');

  // Refs para auto-save y auto-report
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutPillarRef = useRef<NodeJS.Timeout | null>(null);
  const originalAnswers = useRef<FormAnswersDict>({});
  const originalF0Answers = useRef<FormAnswersDict>({});
  const isGeneratingAutoReportRef = useRef(false);
  const basicReportDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastFormUpdatesRef = useRef<Record<string, string>>({});

  // Auto-trigger BASIC report when forms are updated
  useEffect(() => {
    if (!user?.id) return;

    // 1. Verificar que existan todos los formularios
    const f0Form = submittedForms.find(f => f.form_type === 'F0');
    const functionForm = findSubmission(submittedForms, 'FUNCTION');
    const foodForm = findSubmission(submittedForms, 'FOOD');
    const floraForm = findSubmission(submittedForms, 'FLORA');
    const flowForm = findSubmission(submittedForms, 'FLOW');

    const allFormsExist = f0Form && functionForm && foodForm && floraForm && flowForm;
    if (!allFormsExist) return;

    // 2. Detectar si algún formulario fue actualizado
    const currentUpdates: Record<string, string> = {
      F0: f0Form.updated_at || f0Form.submitted_at || '',
      FUNCTION: functionForm.updated_at || functionForm.submitted_at || '',
      FOOD: foodForm.updated_at || foodForm.submitted_at || '',
      FLORA: floraForm.updated_at || floraForm.submitted_at || '',
      FLOW: flowForm.updated_at || flowForm.submitted_at || '',
    };

    // Verificar si hay cambios respecto al último check
    let hasChanges = false;
    for (const [formType, timestamp] of Object.entries(currentUpdates)) {
      if (lastFormUpdatesRef.current[formType] !== timestamp) {
        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) return;

    // Actualizar el ref con los nuevos timestamps
    lastFormUpdatesRef.current = currentUpdates;

    // 3. Debounce: agrupar actualizaciones que ocurran en ventana de 5 minutos
    if (basicReportDebounceRef.current) {
      clearTimeout(basicReportDebounceRef.current);
    }

    basicReportDebounceRef.current = setTimeout(() => {
      // 4. Trigger automático del informe
      if (isGeneratingAutoReportRef.current) return;

      isGeneratingAutoReportRef.current = true;

      fetch('/api/analysis/report-extended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          reportType: 'BASIC',
          manualTrigger: false // Es automático
        }),
      })
        .then(async res => {
          if (res.ok) {
            const data = await res.json();
            if (data.skipped) {
              // Informe no generado por reglas (límite mensual, etc.)
              console.log('[BASIC REPORT] Skipped:', data.reason);
            } else {
              showNotif('Detectamos cambios en tus formularios. Generando Informe Básico actualizado...', 'success');
            }
          } else {
            console.warn('[BASIC REPORT] Generation request failed');
          }
        })
        .catch(err => {
          console.error('[BASIC REPORT] Error triggering auto-report:', err);
        })
        .finally(() => {
          setTimeout(() => {
            isGeneratingAutoReportRef.current = false;
          }, 30000);
        });
    }, 5 * 60 * 1000); // 5 minutos de debounce

    return () => {
      if (basicReportDebounceRef.current) {
        clearTimeout(basicReportDebounceRef.current);
      }
    };
  }, [submittedForms, user?.id, showNotif]);

  const handleLoadFullHistory = useCallback(async () => {
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
  }, [user?.id, fetchAllLogs, setLogs, showNotif]);

  // Check if we should show "Load full history" button
  // Show if logs.length is exactly 90 (default limit) and we haven't loaded all history yet
  const shouldShowLoadHistoryButton = useMemo(() => {
    return logs.length >= 90 && !hasLoadedAllHistory && fetchAllLogs && setLogs;
  }, [logs.length, hasLoadedAllHistory, fetchAllLogs, setLogs]);

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

  // Definir tipos y constantes
  type PillarFormType = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

  const LEGACY_FORM_MAP: Record<'F1' | 'F2' | 'F3', PillarFormType> = {
    F1: 'FUNCTION',
    F2: 'FOOD',
    F3: 'FLOW'
  };

  const PILLAR_TABS: { id: PillarFormType; label: string; iconUrl: string; accent: string }[] = [
    { id: 'FUNCTION', label: 'Function', iconUrl: PILLAR_ICONS.FUNCTION, accent: '#C7958E' },
    { id: 'FOOD', label: 'Food', iconUrl: PILLAR_ICONS.FOOD, accent: '#B67977' },
    { id: 'FLORA', label: 'Flora', iconUrl: PILLAR_ICONS.FLORA, accent: '#6F8A6E' },
    { id: 'FLOW', label: 'Flow', iconUrl: PILLAR_ICONS.FLOW, accent: '#5B7A92' }
  ];

  // Función helper para obtener el estilo de fondo basado en el color accent
  const getPillarAccentClass = (accentColor: string): React.CSSProperties => {
    // Convierte hex a rgba con transparencia del 20%
    const hex = accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`
    };
  };


  // Función para encontrar formulario enviado
  const findSubmission = (forms: ConsultationForm[], type: PillarFormType) => {
    const matching = forms.filter(form => {
      const typeMatches = form.form_type === type || LEGACY_FORM_MAP[form.form_type as keyof typeof LEGACY_FORM_MAP] === type;
      return typeMatches;
    });

    return matching.sort((a, b) => {
      const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return dateB - dateA;
    })[0];
  };

  // Función para guardar F0
  const handleF0Save = async (f0Form?: ConsultationForm) => {
    if (!user?.id) return;

    const formattedAnswers = FORM_DEFINITIONS.F0.questions.map(q => ({
      questionId: q.id,
      question: q.text,
      answer: f0Answers[q.id] || ''
    }));

    // Si no existe el F0, crearlo primero
    let currentF0Form = f0Form;
    if (!currentF0Form) {
      const { data: newForm, error: createError } = await supabase
        .from('consultation_forms')
        .insert({
          user_id: user.id,
          form_type: 'F0',
          answers: formattedAnswers,
          status: 'pending'
        })
        .select()
        .single();

      if (createError || !newForm) {
        showNotif('Error al crear el formulario F0', 'error');
        return;
      }
      currentF0Form = newForm as ConsultationForm;
    } else {
      try {
        await updateConsultationFormById(currentF0Form.id, {
          answers: formattedAnswers,
          status: 'pending'
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error al guardar F0';
        showNotif(errorMessage, 'error');
        return;
      }
    }

    const updates: Partial<UserProfile> = {};
    // También permitimos actualizar el nombre desde la edición de F0
    if (editName && editName !== user.name) {
      updates.name = editName;
    }
    if (f0Answers['q2_weight']) updates.weight = parseFloat(String(f0Answers['q2_weight']));
    if (f0Answers['q2_height']) updates.height = parseFloat(String(f0Answers['q2_height']));
    if (f0Answers['q4_objective']) updates.mainObjective = String(f0Answers['q4_objective']);
    
    // Procesar campos faltantes del F0
    if (f0Answers['q5_partner']) updates.partnerStatus = String(f0Answers['q5_partner']);
    if (f0Answers['q20_fertility_treatments']) updates.fertilityTreatments = String(f0Answers['q20_fertility_treatments']);
    if (f0Answers['q9_diagnoses']) updates.diagnoses = String(f0Answers['q9_diagnoses']);
    if (f0Answers['q21_family_history']) updates.familyHistory = String(f0Answers['q21_family_history']);
    
    // Procesar fecha de nacimiento y calcular edad
    if (f0Answers['q1_birthdate']) {
      const birthDateStr = String(f0Answers['q1_birthdate']);
      const calculatedAge = calculateAgeFromBirthdate(birthDateStr);
      
      if (calculatedAge !== null) {
        updates.birthDate = birthDateStr;
        updates.age = calculatedAge;
      } else {
        showNotif('La fecha de nacimiento debe corresponder a una edad entre 18-55 años', 'error');
        return;
      }
    }
    
    // Nota: cycle_length ya no se guarda en F0, se maneja desde FUNCTION

    // Set time_trying fields if q3_time_trying is present
    if (f0Answers['q3_time_trying']) {
      const initialMonths = parseInt(String(f0Answers['q3_time_trying']).replace(/\D/g, '')) || 0;
      const submissionDate = currentF0Form.submitted_at || new Date().toISOString();
      const startDate = submissionDate.split('T')[0]; // Get YYYY-MM-DD format

      const success = await setTimeTryingStart(user.id, initialMonths, startDate);
      if (success) {
        updates.timeTryingStartDate = startDate;
        updates.timeTryingInitialMonths = initialMonths;
        updates.timeTrying = calculateCurrentMonthsTrying(startDate, initialMonths) || undefined;
      }
    }

    if (Object.keys(updates).length > 0) {
      const profileUpdates: Partial<{
        name: string;
        weight: number;
        height: number;
        main_objective: string;
        partner_status: string;
        fertility_treatments: string;
        diagnoses: string;
        family_history: string;
        birth_date: string;
        age: number;
      }> = {};
      if (updates.name !== undefined) profileUpdates.name = updates.name;
      if (updates.weight !== undefined) profileUpdates.weight = updates.weight;
      if (updates.height !== undefined) profileUpdates.height = updates.height;
      if (updates.mainObjective !== undefined) profileUpdates.main_objective = updates.mainObjective;
      if (updates.partnerStatus !== undefined) profileUpdates.partner_status = updates.partnerStatus;
      if (updates.fertilityTreatments !== undefined) profileUpdates.fertility_treatments = updates.fertilityTreatments;
      if (updates.diagnoses !== undefined) profileUpdates.diagnoses = updates.diagnoses;
      if (updates.familyHistory !== undefined) profileUpdates.family_history = updates.familyHistory;
      if (updates.birthDate !== undefined) profileUpdates.birth_date = updates.birthDate;
      if (updates.age !== undefined) profileUpdates.age = updates.age;

      const updateResult = await updateProfileForUser(user.id, profileUpdates);
      if (updateResult.success === false) {
        showNotif(updateResult.error || 'No pudimos actualizar tu perfil', 'error');
        return;
      }
      setUser({ ...user, ...updates });
    }

    showNotif('Ficha Personal actualizada correctamente', 'success');
    setIsEditingF0(false);
    // Recargar formularios para que aparezca el F0 en modo lectura
    await fetchUserForms(user.id);
  };

  // Función para reiniciar método
  const handleRestartClick = async () => {
    if (window.confirm('¿Estás segura de que quieres reiniciar el método? Esto eliminará todos tus datos de progreso.')) {
      await onRestartMethod();
    }
  };

  // Sincronizar f0Answers cuando user o submittedForms cambien (solo si no está editando)
  useEffect(() => {
    if (isEditingF0) return; // No sincronizar si está editando para no perder cambios del usuario

    const f0Form = submittedForms.find(f => f.form_type === 'F0');
    if (f0Form && f0Form.answers) {
      const syncedAnswers: FormAnswersDict = {};
      f0Form.answers.forEach((a: FormAnswer) => {
        syncedAnswers[a.questionId] = a.answer;
      });

      // Nota: cycle_length ya no está en F0, se maneja desde FUNCTION

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
      if (isEditingProfile || isEditingF0 || isEditMode) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleTabChange);
    return () => window.removeEventListener('beforeunload', handleTabChange);
  }, [isEditingProfile, isEditingF0, isEditMode]);

  // Lógica de pilares
  const definition = FORM_DEFINITIONS[formType];
  const submittedForm = useMemo(() => findSubmission(submittedForms, formType), [submittedForms, formType]);

  // Helper helper to check visibility based on dependencies
  const isQuestionVisible = (questionId: string, formAnswers: any[]) => {
    // FUNCTION: 'function_luteal_phase' depends on 'function_knows_fertile_days' === 'Sí'
    if (questionId === 'function_luteal_phase') {
      const dependency = formAnswers.find((a: any) => a.questionId === 'function_knows_fertile_days');
      return dependency?.answer === 'Sí';
    }
    return true;
  };

  // Calculate progress for current form based on submitted form, not local answers
  const progress = useMemo(() => {
    if (!definition?.questions) return { answered: 0, total: 0, percentage: 0 };

    // If no form has been submitted, progress is 0%
    if (!submittedForm || !submittedForm.answers || !Array.isArray(submittedForm.answers)) {
      // For initial state, we assume total is all *visible* questions assuming default dependencies? 
      // Actually if not submitted, we can't really know dependencies defaults easily without answers.
      // Let's Just return 0.
      return { answered: 0, total: definition.questions.length, percentage: 0 };
    }

    const formAnswers = submittedForm.answers;

    // Filter questions that are currently visible based on answers
    const visibleQuestions = definition.questions.filter(q => isQuestionVisible(q.id, formAnswers));

    const totalQuestions = visibleQuestions.length;
    const answeredQuestions = visibleQuestions.filter(question => {
      const answer = formAnswers.find((a: any) => a.questionId === question.id);
      if (!answer) return false;
      const value = answer.answer;

      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;

      return true;
    }).length;

    return {
      answered: answeredQuestions,
      total: totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
    };
  }, [definition, submittedForm]);

  // Calculate progress for each pillar based on submitted forms
  const getPillarProgress = (pillarId: PillarFormType): number => {
    const form = findSubmission(submittedForms, pillarId);
    if (!form || !form.answers || !Array.isArray(form.answers)) return 0;

    const pillarDef = FORM_DEFINITIONS[pillarId as keyof typeof FORM_DEFINITIONS];
    if (!pillarDef?.questions) return 0;

    const formAnswers = form.answers;
    // Filter visible questions
    // We need to use the isQuestionVisible logic here too, but simple copy is fine or defining it outside
    const isVisible = (qId: string) => {
      if (qId === 'function_luteal_phase') {
        const dependency = formAnswers.find((a: any) => a.questionId === 'function_knows_fertile_days');
        return dependency?.answer === 'Sí';
      }
      return true;
    };

    const visibleQuestions = pillarDef.questions.filter(q => isVisible(q.id));
    const totalQuestions = visibleQuestions.length;

    const answeredQuestions = visibleQuestions.filter(question => {
      const answer = formAnswers.find((a: any) => a.questionId === question.id);
      if (!answer) return false;
      const value = answer.answer;

      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;

      return true;
    }).length;

    return totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  };

  useEffect(() => {
    if (!definition || !('sections' in definition) || !definition.sections) {
      setOpenSections({});
      return;
    }
    const initialState: Record<string, boolean> = {};
    if (Array.isArray(definition.sections)) {
      definition.sections.forEach((section: any, index: number) => {
        initialState[section.id] = index === 0;
      });
    }
    setOpenSections(initialState);
  }, [definition]);

  useEffect(() => {
    if (!definition) return;
    if (submittedForm) {
      const loaded: FormAnswersDict = {};
      if (Array.isArray(submittedForm.answers)) {
        submittedForm.answers.forEach((answer: FormAnswer) => {
          // Handle Flora "Otra" fields - split if contains ": "
          if ((answer.questionId === 'flora_pruebas' || answer.questionId === 'flora_suplementos') && typeof answer.answer === 'string' && answer.answer.includes(': ')) {
            const [mainValue, otherValue] = answer.answer.split(': ', 2);
            loaded[answer.questionId] = mainValue;
            if (otherValue) {
              loaded[`${answer.questionId}_otro`] = otherValue;
            }
          } else {
            loaded[answer.questionId] = answer.answer;
          }
        });
      }
      setAnswers(loaded);
    } else {
      const defaults: FormAnswersDict = {};
      definition.questions?.forEach(question => {
        if ('defaultValue' in question && question.defaultValue !== undefined) {
          defaults[question.id] = question.defaultValue as string | number | boolean | string[];
        }
      });
      setAnswers(defaults);
    }
    setIsEditMode(false);
  }, [definition, formType, submittedForm]);

  // Guardado automático después de 5 minutos de inactividad para pilares
  useEffect(() => {
    if (!isEditMode || !definition) return;

    if (autoSaveTimeoutPillarRef.current) {
      clearTimeout(autoSaveTimeoutPillarRef.current);
    }

    autoSaveTimeoutPillarRef.current = setTimeout(() => {
      handlePillarSubmit();
    }, 300000); // 5 minutos

    return () => {
      if (autoSaveTimeoutPillarRef.current) {
        clearTimeout(autoSaveTimeoutPillarRef.current);
      }
    };
  }, [answers, isEditMode, definition]);

  const handleCancelEdit = () => {
    setAnswers(JSON.parse(JSON.stringify(originalAnswers.current)));
    setIsEditMode(false);
    if (autoSaveTimeoutPillarRef.current) {
      clearTimeout(autoSaveTimeoutPillarRef.current);
      autoSaveTimeoutPillarRef.current = null;
    }
  };

  const handlePillarSubmit = async () => {
    if (!user?.id || !definition) return;

    if (autoSaveTimeoutPillarRef.current) {
      clearTimeout(autoSaveTimeoutPillarRef.current);
      autoSaveTimeoutPillarRef.current = null;
    }

    const missingRequired = definition.questions.filter(question => {
      if ('optional' in question && question.optional) return false;
      const value = answers[question.id];
      return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    });

    if (missingRequired.length > 0) {
      const missingText =
        missingRequired.length > 3
          ? `${missingRequired.length} campos obligatorios`
          : missingRequired.map(q => q.text).join(', ');
      showNotif('Completa todos los campos obligatorios (' + missingText + ')', 'error');
      return;
    }

    const formattedAnswers = definition.questions.map(question => {
      const baseAnswer = answers[question.id] ?? '';
      // For Flora "Otra" options, combine with the "otro" field if it exists
      if ((question.id === 'flora_pruebas' || question.id === 'flora_suplementos') && (baseAnswer === 'Otra' || baseAnswer === 'Otro')) {
        const otroValue = answers[`${question.id}_otro`] || '';
        return {
          questionId: question.id,
          question: question.text,
          answer: otroValue ? `${baseAnswer}: ${otroValue}` : baseAnswer
        };
      }
      return {
        questionId: question.id,
        question: question.text,
        answer: baseAnswer
      };
    });

    // Use dual saving: pillar table (current state) + consultation_forms (history)
    const result = await savePillarForm(user.id, formType, answers, logs, formattedAnswers);

    if (result.success) {
      // ⭐ Si es FUNCTION, refrescar user para obtener cycle_length actualizado
      if (formType === 'FUNCTION') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('cycle_length, cycle_regularity')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUser({
            ...user,
            cycleLength: profile.cycle_length ?? user.cycleLength,
            cycleRegularity: profile.cycle_regularity === 'regular'
              ? 'Regular'
              : profile.cycle_regularity === 'irregular'
                ? 'Irregular'
                : user.cycleRegularity
          });
        }
      }

      showNotif('Formulario guardado correctamente.', 'success');
      fetchUserForms(user.id);
    } else {
      showNotif(result.error || 'Error al guardar el formulario', 'error');
    }
  };

  const updateAnswer = useCallback((id: string, value: string | number | boolean | string[] | undefined) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  const handleDataExtracted = useCallback((data: FormAnswersDict) => {
    setAnswers(prev => ({ ...prev, ...data }));
    showNotif('Datos extraídos correctamente. Revisa y confirma los valores.', 'success');
  }, [showNotif]);

  // Handler para datos extraídos del scanner global (no afecta pilares)

  const renderNumberControl = (question: any) => {
    const step = question.step ?? 1;
    const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
    const rawValue = answers[question.id];
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
        <button onClick={() => handleAdjust(-1)} className="w-10 h-10 rounded-2xl border border-ferty-beigeBorder text-ferty-coral font-bold text-lg bg-white hover:bg-ferty-beige" type="button">
          -
        </button>
        <div className="flex-1 text-center bg-ferty-beigeLight border border-ferty-beige rounded-2xl py-2">
          <p className="text-lg font-bold text-ferty-dark">{numericValue !== undefined && !Number.isNaN(numericValue) ? numericValue : '—'}</p>
          {question.unit && <p className="text-[11px] text-ferty-coral font-semibold">{question.unit}</p>}
        </div>
        <button onClick={() => handleAdjust(1)} className="w-10 h-10 rounded-2xl border border-ferty-beigeBorder text-ferty-coral font-bold text-lg bg-white hover:bg-ferty-beige" type="button">
          +
        </button>
      </div>
    );
  };

  const renderSliderControl = (question: any) => {
    const min = question.min ?? 0;
    const max = question.max ?? 100;
    const step = question.step ?? 1;
    const rawValue = answers[question.id];
    const currentValue =
      typeof rawValue === 'number'
        ? rawValue
        : rawValue !== undefined && rawValue !== ''
          ? Number(rawValue)
          : question.defaultValue ?? min;
    const safeValue = Number.isFinite(currentValue) ? currentValue : min;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-ferty-coral">
          <span>
            {safeValue}
            {question.unit ? ` ${question.unit}` : ''}
          </span>
          <span className="text-ferty-beigeMuted">
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
          className="w-full accent-ferty-rose"
          onChange={event => {
            const val = parseFloat(event.target.value);
            const step = question.step ?? 1;
            // Redondear al step más cercano para evitar problemas de precisión
            const rounded = Math.round(val / step) * step;
            const finalValue = Number(rounded.toFixed(2));
            updateAnswer(question.id, Number.isFinite(finalValue) ? finalValue : safeValue);
          }}
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
          const isActive = answers[question.id] === optionValue;
          return (
            <button
              key={option}
              type="button"
              onClick={() => updateAnswer(question.id, optionValue)}
              className={`px-3 py-2 text-xs font-bold rounded-full border transition-all ${isActive ? 'bg-ferty-rose text-white border-ferty-rose' : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
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
        const isActive = answers[question.id] === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => updateAnswer(question.id, option)}
            className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all ${isActive ? 'bg-ferty-coral text-white border-ferty-coral' : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
              }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );

  const renderPercentageControl = (question: any) => {
    const min = question.min ?? 0;
    const max = question.max ?? 4;
    const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-ferty-coral">
          <span>Nivel: {answers[question.id] ?? min}</span>
          <span className="text-ferty-beigeMuted">0 – {max}</span>
        </div>
        <div className="flex gap-1">
          {values.map((value: number) => {
            const isActive = answers[question.id] === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => updateAnswer(question.id, value)}
                className={`flex-1 h-8 rounded-lg border transition-all ${isActive
                  ? 'bg-ferty-rose border-ferty-rose'
                  : 'bg-ferty-beige border-ferty-beigeBorder hover:bg-ferty-beigeBorder'
                  }`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderFlowFacesControl = (question: any) => {
    const min = question.min ?? 1;
    const max = question.max ?? 5;
    const variant = question.variant ?? 'stress';
    const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

    // Estrés: 1=tranquila → 5=abrumada. Emoción: 1=ansiosa → 7=empoderada. Digestiva: 1=muy mal → 7=excelente
    const stressIcons = [Smile, Meh, Frown, Angry, XCircle]; // 5 iconos para escala 1-5
    const emotionIcons = [Frown, Meh, Meh, Meh, Smile, Smile, Heart]; // 7 iconos para escala 1-7
    const digestiveIcons = [XCircle, Frown, Frown, Meh, Meh, Smile, Smile]; // 7 iconos para escala 1-7
    const icons =
      variant === 'emotion' ? emotionIcons
        : variant === 'digestive' ? digestiveIcons
          : stressIcons;

    const isFlora = question.id === 'flora_dig';
    const activeClass = isFlora ? 'bg-ferty-flora-accent/20 text-ferty-flora-accent' : 'bg-ferty-rose/20 text-ferty-coral';
    const iconClass = isFlora ? 'text-ferty-flora-accent' : 'text-ferty-coral';

    return (
      <div className="flex justify-center gap-1">
        {values.map((value, index) => {
          const IconComponent = icons[index] || Smile;
          const isActive = answers[question.id] === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => updateAnswer(question.id, value)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${isActive ? `${activeClass} scale-110` : 'text-ferty-beigeMuted hover:text-ferty-gray hover:bg-ferty-beige/50 opacity-70 hover:opacity-100'
                }`}
            >
              <IconComponent size={26} strokeWidth={1.5} className={isActive ? iconClass : 'text-ferty-beigeMuted'} />
            </button>
          );
        })}
      </div>
    );
  };

  const renderFacesControl = (question: any) => {
    const min = question.min ?? 0;
    const max = question.max ?? 4;
    const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);

    // Emojis mapping for 0-4 scale (0=Good/Happy, 4=Bad/Angry)
    const faces = ['😀', '😐', '🙁', '😠', '🤬'];
    const labels = ['Nada', 'Leve', 'Moderado', 'Fuerte', 'Insoportable'];

    return (
      <div className="space-y-3">
        <div className="flex justify-between px-2">
          {values.map((value, index) => {
            const isActive = answers[question.id] === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => updateAnswer(question.id, value)}
                className={`flex flex-col items-center gap-1 transition-transform hover:scale-110 ${isActive ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}
              >
                <span className="text-3xl">{faces[index] || '•'}</span>
                <span className={`text-[9px] font-bold uppercase ${isActive ? 'text-ferty-rose' : 'text-ferty-gray'}`}>
                  {labels[index]}
                </span>
                {isActive && <div className="w-1.5 h-1.5 bg-ferty-rose rounded-full mt-1" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderControl = (question: FormQuestion) => {
    const controlType = question.control ?? question.type;

    // Flow-specific variations - simplified controls
    if (formType === 'FLOW') {
      // No special cases needed - use default controls
    }

    if (question.type === 'flow_faces') {
      return renderFlowFacesControl(question);
    }

    if (question.type === 'faces') {
      return renderFacesControl(question);
    }

    // Flora - conditional text field for "Otra"
    if (formType === 'FLORA' && (question.id === 'flora_pruebas' || question.id === 'flora_suplementos')) {
      const selectedValue = answers[question.id];
      const showOtherField = selectedValue === 'Otra' || selectedValue === 'Otro';

      return (
        <div className="space-y-3">
          {renderButtons(question, question.options || [])}
          {showOtherField && (
            <input
              type="text"
              value={answers[`${question.id}_otro`] || ''}
              placeholder="Especifica..."
              onChange={event => updateAnswer(`${question.id}_otro`, event.target.value)}
              className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose"
            />
          )}
        </div>
      );
    }

    if (question.type === 'textarea') {
      return (
        <textarea
          value={answers[question.id] || ''}
          className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose focus:ring-1 focus:ring-ferty-rose"
          rows={4}
          onChange={event => updateAnswer(question.id, event.target.value)}
        />
      );
    }

    if (question.type === 'yesno') {
      return renderButtons(question, ['Sí', 'No']);
    }

    if (question.type === 'buttons' && Array.isArray(question.options)) {
      return renderButtons(question, question.options);
    }

    if (question.type === 'segmented') {
      return renderSegmentedControl(question);
    }

    if (question.type === 'select') {
      return (
        <select
          value={answers[question.id] || ''}
          onChange={event => updateAnswer(question.id, event.target.value)}
          className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-white focus:border-ferty-rose"
        >
          <option value="">Seleccionar…</option>
          {question.options?.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (question.type === 'date') {
      return (
        <input
          type="date"
          value={answers[question.id] || ''}
          onChange={event => updateAnswer(question.id, event.target.value)}
          className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose"
        />
      );
    }

    if (controlType === 'slider' || question.type === 'slider') {
      return renderSliderControl(question);
    }

    if (controlType === 'stepper' || question.type === 'stepper' || question.type === 'number') {
      return renderNumberControl(question);
    }

    return (
      <input
        type="text"
        value={answers[question.id] || ''}
        onChange={event => updateAnswer(question.id, event.target.value)}
        className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose"
      />
    );
  };

  // renderFunctionForm eliminado - ahora FUNCTION usa renderGeneralForm() como los otros pilares

  const renderGeneralForm = () => {
    if (!definition?.questions || definition.questions.length === 0) {
      return (
        <div className="text-center py-8 text-stone-400">
          <p className="text-sm">No hay preguntas disponibles para este formulario.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {definition.questions.map(question => {
          // Lógica de dependencias
          // FUNCTION: 'function_luteal_phase' solo si 'function_knows_fertile_days' == 'Sí'
          if (question.id === 'function_luteal_phase') {
            const knows = answers['function_knows_fertile_days'];
            if (knows !== 'Sí') return null;
          }

          return (
            <div key={question.id} className="bg-ferty-beigeLight border border-ferty-beige rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ferty-dark uppercase tracking-wider">{question.text}</label>
                {question.unit && <span className="text-[11px] text-ferty-coral font-semibold">{question.unit}</span>}
              </div>
              {renderControl(question)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormCard = () => {
    const currentTab = PILLAR_TABS.find(tab => tab.id === formType);
    return (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-ferty-beige">
        <div className="flex items-center justify-between mb-6 border-b border-ferty-beige pb-4">
          <div className="flex items-center gap-3 flex-1">
            {currentTab && (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={getPillarAccentClass(currentTab.accent)}>
                  <img src={currentTab.iconUrl} alt={`${currentTab.label} icono`} className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ferty-dark">{currentTab.label}</h4>
                  {submittedForm?.submitted_at && (
                    <div className="mt-0.5">
                      <p className="text-xs font-semibold text-ferty-gray">Última Actualización:</p>
                      <p className="text-xs text-ferty-gray">{formatDate(submittedForm.submitted_at, 'long')}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {submittedForm ? (
            <>
              {isEditMode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="text-ferty-coral hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
                    title="Cancelar"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={handlePillarSubmit}
                    className="text-ferty-rose hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
                    title="Guardar"
                  >
                    <Check size={16} />
                  </button>
                </div>
              )}
              {!isEditMode && (
                <button
                  onClick={() => {
                    originalAnswers.current = JSON.parse(JSON.stringify(answers));
                    setIsEditMode(true);
                  }}
                  className="text-ferty-rose hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
                  title="Editar formulario"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </>
          ) : (
            // ⭐ Si no hay formulario guardado, mostrar indicador
            <div className="text-xs text-ferty-gray bg-ferty-beigeLight px-3 py-1.5 rounded-lg">
              Formulario sin completar
            </div>
          )}
        </div>
        {renderGeneralForm()}
        <button onClick={handlePillarSubmit} className="w-full bg-ferty-gray text-white py-4 rounded-xl font-bold shadow-lg mt-8 hover:bg-ferty-grayHover transition-all flex items-center justify-center gap-2">
          {submittedForm ? 'Actualizar formulario' : 'Guardar y enviar'} <Download size={16} />
        </button>
      </div>
    );
  };

  const renderSubmittedView = () => {
    const currentTab = PILLAR_TABS.find(tab => tab.id === formType);

    return (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-ferty-beige">
        <div className="flex items-center justify-between mb-4 border-b border-ferty-beige pb-4">
          <div className="flex items-center gap-3 flex-1">
            {currentTab && (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={getPillarAccentClass(currentTab.accent)}>
                  <img src={currentTab.iconUrl} alt={`${currentTab.label} icono`} className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ferty-dark">{currentTab.label}</h4>
                  {submittedForm?.submitted_at && (
                    <div className="mt-0.5">
                      <p className="text-xs font-semibold text-ferty-gray">Última Actualización:</p>
                      <p className="text-xs text-ferty-gray">{formatDate(submittedForm.submitted_at, 'long')}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditMode && (
              <button
                onClick={handleCancelEdit}
                className="text-ferty-coral hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
                title="Cancelar"
              >
                <X size={16} />
              </button>
            )}
            <button
              onClick={() => {
                if (isEditMode) {
                  handlePillarSubmit();
                } else {
                  originalAnswers.current = JSON.parse(JSON.stringify(answers));
                  setIsEditMode(true);
                }
              }}
              className="text-ferty-rose hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
              title={isEditMode ? "Guardar" : "Editar formulario"}
            >
              {isEditMode ? <Check size={16} /> : <Edit2 size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {(() => {
            // ⭐ Filtrar respuestas: solo mostrar las que corresponden a las preguntas ACTUALES del formulario
            // Esto asegura que solo se muestren las nuevas preguntas, no las antiguas
            const definition = FORM_DEFINITIONS[formType as keyof typeof FORM_DEFINITIONS];
            const validQuestionIds = definition?.questions
              ? new Set(definition.questions.map((q: any) => q.id))
              : new Set();

            // También incluir campos legacy que pueden estar en FUNCTION
            if (formType === 'FUNCTION') {
              validQuestionIds.add('q9_diagnoses');
              validQuestionIds.add('q20_fertility_treatments');
            }

            const filteredAnswers = (submittedForm?.answers || []).filter((answer: any) => {
              // Excluir campos específicos de exámenes/análisis IA
              if (
                answer.questionId === 'exam_type' ||
                answer.questionId === 'gemini_comment' ||
                answer.questionId === 'rag_analysis'
              ) {
                return false;
              }

              // ⭐ Para TODOS los pilares, solo mostrar respuestas que corresponden a las preguntas actuales del formulario
              // Esto asegura que solo se muestren las nuevas preguntas, no las antiguas
              return validQuestionIds.has(answer.questionId);
            });

            // Si no hay respuestas filtradas, mostrar mensaje
            if (filteredAnswers.length === 0) {
              return (
                <div className="text-center py-8 text-stone-400">
                  <p className="text-sm">No hay respuestas guardadas para este formulario.</p>
                  <button
                    onClick={() => {
                      originalAnswers.current = JSON.parse(JSON.stringify(answers));
                      setIsEditMode(true);
                    }}
                    className="mt-4 bg-ferty-rose text-white px-6 py-3 rounded-xl font-bold hover:bg-ferty-roseHover transition-colors"
                  >
                    Completar formulario
                  </button>
                </div>
              );
            }

            // Función helper para renderizar un campo (una columna)
            const renderField = (label: string, value: any) => {
              const displayValue = Array.isArray(value) ? value.join(', ') : (value ?? '—');
              const isEmpty = !value || (Array.isArray(value) && value.length === 0);

              return (
                <div key={label} className="border-b border-ferty-beige/50 pb-3 last:border-0 last:pb-0">
                  <p className="text-[10px] text-ferty-gray mb-0.5">{label}</p>
                  <p className={`text-sm font-semibold ${isEmpty ? 'text-stone-400 italic' : 'text-ferty-dark'}`}>
                    {isEmpty ? 'Sin respuesta' : displayValue}
                  </p>
                </div>
              );
            };

            const visibleFilteredAnswers = filteredAnswers.filter((answer: any) =>
              isQuestionVisible(answer.questionId, submittedForm.answers)
            );

            return (
              <div className="border-b border-ferty-beige pb-3">
                <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                  {currentTab?.label || 'Formulario'}
                </p>
                <div className="flex flex-col gap-3">
                  {visibleFilteredAnswers.map((answer: any) => {
                    const question = definition?.questions?.find((q: any) => q.id === answer.questionId);
                    const label = question?.text || answer.question;
                    const value = answer.answer;

                    // Si es tipo 'faces', mostrar icono + etiqueta
                    if (question?.type === 'faces' && typeof value === 'number') {
                      const FaceIconsView = [Smile, Meh, Frown, Angry, XCircle];
                      const faceLabels = ['Nada', 'Leve', 'Moderado', 'Fuerte', 'Insoportable'];
                      const IconComponent = FaceIconsView[value] || Meh;
                      const faceLabel = faceLabels[value] ?? '';
                      return (
                        <div key={label} className="border-b border-ferty-beige/50 pb-3 last:border-0 last:pb-0">
                          <p className="text-[10px] text-ferty-gray mb-0.5">{label}</p>
                          <div className="flex items-center gap-2">
                            <IconComponent size={24} strokeWidth={1.5} className="text-ferty-coral" />
                            <p className="text-sm font-semibold text-ferty-dark">{faceLabel}</p>
                          </div>
                        </div>
                      );
                    }

                    // flow_stress / flow_emocion / flora_dig: iconos 1-7
                    if ((answer.questionId === 'flow_stress' || answer.questionId === 'flow_emocion' || answer.questionId === 'flora_dig') && typeof value === 'number') {
                      const stressIcons = [Smile, Meh, Meh, Frown, Frown, Angry, XCircle];
                      const emotionIcons = [Frown, Meh, Meh, Meh, Smile, Smile, Heart];
                      const digestiveIcons = [XCircle, Frown, Frown, Meh, Meh, Smile, Smile];
                      const icons = answer.questionId === 'flow_emocion' ? emotionIcons : answer.questionId === 'flora_dig' ? digestiveIcons : stressIcons;
                      const idx = Math.min(Math.max(value - 1, 0), 6);
                      const IconComponent = icons[idx] || Meh;
                      const iconColor = answer.questionId === 'flora_dig' ? 'text-ferty-flora-accent' : 'text-ferty-coral';
                      return (
                        <div key={label} className="border-b border-ferty-beige/50 pb-3 last:border-0 last:pb-0">
                          <p className="text-[10px] text-ferty-gray mb-0.5">{label}</p>
                          <div className="flex items-center gap-2">
                            <IconComponent size={24} strokeWidth={1.5} className={iconColor} />
                          </div>
                        </div>
                      );
                    }

                    // flow_ejer: JSON → texto legible
                    if (answer.questionId === 'flow_ejer' && typeof value === 'string' && value !== 'Ninguno') {
                      try {
                        const obj = JSON.parse(value);
                        const parts = Object.entries(obj).map(([k, v]: [string, any]) =>
                          v?.cantidad != null ? `${k}: ${v.cantidad} veces/sem, ${v.intensidad || 'Media'}` : null
                        ).filter(Boolean);
                        return renderField(label, parts.length > 0 ? parts.join(' • ') : '—');
                      } catch {
                        return renderField(label, value);
                      }
                    }

                    // flow_entorno_social
                    if (answer.questionId === 'flow_entorno_social' && typeof value === 'string') {
                      const display = value.includes('::') ? value.replace('::', ' — ') : value;
                      return renderField(label, display || '—');
                    }

                    // flow_sueno, flow_relax, steppers con unidad
                    if (answer.questionId === 'flow_sueno' && (typeof value === 'number' || typeof value === 'string')) {
                      const num = typeof value === 'string' ? parseFloat(value) : value;
                      return renderField(label, Number.isFinite(num) ? `${num} horas` : value);
                    }
                    if ((answer.questionId === 'flow_relax' || answer.questionId === 'food_azucar' || answer.questionId === 'food_pescado' || answer.questionId === 'flora_ferm') && (typeof value === 'number' || typeof value === 'string')) {
                      return renderField(label, `${value} veces/semana`);
                    }
                    if (answer.questionId === 'food_vege' && (typeof value === 'number' || typeof value === 'string')) {
                      return renderField(label, `${value} raciones`);
                    }
                    if ((answer.questionId === 'function_cycle_length' || answer.questionId === 'function_luteal_phase') && (typeof value === 'number' || typeof value === 'string')) {
                      return renderField(label, `${value} días`);
                    }

                    return renderField(label, value);
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24 pt-0">
      <ProfileHeader
        user={user}
        logs={logs}
        logsCount={logs.length}
        scores={scores}
        submittedForms={submittedForms}
      />

      <div className="p-5 pt-0">
        {/* Guidance Banner for Onboarding */}
        {(() => {
          const formsStatus = {
            F0: !!submittedForms.some(f => f.form_type === 'F0'),
            FUNCTION: !!findSubmission(submittedForms, 'FUNCTION'),
            FOOD: !!findSubmission(submittedForms, 'FOOD'),
            FLORA: !!findSubmission(submittedForms, 'FLORA'),
            FLOW: !!findSubmission(submittedForms, 'FLOW'),
          };
          const completedCount = Object.values(formsStatus).filter(Boolean).length;
          const totalForms = 5;
          const isComplete = completedCount === totalForms;

          if (isComplete) return null; // Don't show if all done (or show a "All set!" message?)

          return (
            <div className="mb-6 bg-gradient-to-r from-ferty-rose/10 to-transparent p-4 rounded-2xl border border-ferty-rose/20">
              <div className="flex items-start gap-4">
                <div className="bg-white p-2 rounded-full shadow-sm text-ferty-rose mt-1">
                  {/* Using CheckCircle as Sparkles isn't imported yet, or I should import it. 
                       I'll stick to icons available or simple ones. CheckCircle is good. 
                   */}
                  <CheckCircle size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-ferty-dark text-lg mb-1">
                    ¡Completa tu Perfil!
                  </h3>
                  <p className="text-sm text-ferty-gray mb-3 leading-relaxed">
                    Para generar tu primer <strong>Informe Básico</strong>, necesitamos que completes tu Ficha Personal (F0) y los 4 pilares.
                  </p>

                  {/* Progress Bar */}
                  <div className="w-full bg-white h-2.5 rounded-full overflow-hidden mb-2 border border-ferty-beige">
                    <div
                      className="bg-ferty-rose h-full transition-all duration-1000 ease-out"
                      style={{ width: `${(completedCount / totalForms) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-ferty-rose text-right">
                    {completedCount} de {totalForms} completados
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Links discretos para navegar */}
        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-ferty-dark">Historia</span>
            <button
              onClick={() => setView('ANALYTICS')}
              className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
            >
              Analíticas →
            </button>
            <button
              onClick={() => setView('REPORTS')}
              className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
            >
              Informes →
            </button>
          </div>
          <button
            onClick={() => setView('MY_PROFILE')}
            className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
          >
            Editar perfil →
          </button>
        </div>

        {(() => {
          const f0Form = submittedForms.find(f => f.form_type === 'F0');
          const medicalData = generarDatosInformeMedico(user, logs);
          return (
            <div className="space-y-4">
              {/* Bloque de Salud General, Hábitos y Análisis de Edad */}
              {medicalData && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-ferty-beige space-y-4">
                  <div className="border-b border-ferty-beige pb-3">
                    <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">Salud General</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-ferty-gray mb-0.5">Edad</p>
                        <p className="text-sm font-semibold text-ferty-dark">{medicalData.edad} años</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ferty-gray mb-0.5">Peso</p>
                        <p className="text-sm font-semibold text-ferty-dark">{medicalData.pesoActual} kg</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ferty-gray mb-0.5">Altura</p>
                        <p className="text-sm font-semibold text-ferty-dark">
                          {typeof user.height === 'number' ? `${user.height} cm` : user.height ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ferty-gray mb-0.5">IMC</p>
                        <p className="text-sm font-semibold text-ferty-dark">
                          {medicalData.imc.valor} ({medicalData.imc.categoria})
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-ferty-gray mb-0.5">Peso ideal</p>
                        <p className="text-sm font-semibold text-ferty-dark">
                          {medicalData.pesoIdeal.minimo}-{medicalData.pesoIdeal.maximo} kg
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Resumen F0: Ciclo / Objetivo e Historial, debajo de Salud General */}
                  {f0Form && f0Form.answers && (() => {
                    const getAnswer = (id: string) =>
                      f0Form.answers.find(a => a.questionId === id)?.answer ?? null;

                    const toSingleLine = (value: any, maxLength: number = 160) => {
                      if (value == null) return null;
                      let text = String(value).replace(/\s+/g, ' ').trim();
                      if (!text) return null;
                      if (text.length > maxLength) {
                        text = text.slice(0, maxLength - 1) + '…';
                      }
                      return text;
                    };

                    const height = getAnswer('q2_height');
                    const weight = getAnswer('q2_weight');
                    // cycle_length y regularity ya no están en F0, se manejan desde FUNCTION
                    const objective = getAnswer('q4_objective');
                    const partner = getAnswer('q5_partner');
                    const timeTrying = getAnswer('q3_time_trying');
                    const treatments = getAnswer('q20_fertility_treatments');
                    const diagnoses = getAnswer('q9_diagnoses');
                    const familyHistory = getAnswer('q21_family_history');

                    const renderField = (label: string, value: any) => (
                      <div className="border-b border-ferty-beige pb-3 last:border-0">
                        <p className="text-[11px] text-ferty-gray mb-0.5">{label}</p>
                        <p className="text-sm font-semibold text-ferty-dark">
                          {value ?? '—'}
                        </p>
                      </div>
                    );

                    return (
                      <>
                        {/* OBJETIVO (en Historia) */}
                        <div className="border-b border-ferty-beige pb-3">
                          <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                            OBJETIVO
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            {/* cycle_length y regularity ya no están en F0, se muestran en FUNCTION */}
                            {renderField('Tiempo buscando embarazo', toSingleLine(timeTrying))}
                            {renderField('Objetivo principal', objective)}
                            {renderField('Pareja o solitario', partner)}
                            {renderField(
                              'Tratamientos de fertilidad previos',
                              toSingleLine(treatments)
                            )}
                          </div>
                        </div>

                        {/* HISTORIAL Y DIAGNÓSTICOS (en Historia, en una columna por bloque) */}
                        <div>
                          <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                            HISTORIAL Y DIAGNÓSTICOS
                          </p>
                          <div className="space-y-4">
                            {renderField('Diagnósticos / Historia médica', toSingleLine(diagnoses))}
                            {renderField('Historia familiar', toSingleLine(familyHistory))}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Análisis de Edad (justo después de datos físicos / ciclo / historial) */}
                  <div>
                    <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">Análisis de Edad</p>
                    <p className="text-sm font-semibold text-ferty-dark mb-1">
                      {medicalData.analisisEdad.categoria} - {medicalData.analisisEdad.probabilidad}
                    </p>
                    <p className="text-[10px] text-ferty-gray">{medicalData.analisisEdad.mensaje}</p>
                  </div>

                  {/* Hábitos (últimos 7 días) */}
                  <div className="border-b border-ferty-beige pb-3">
                    <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">Hábitos (últimos 7 días)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-ferty-gray mb-0.5">Sueño</p>
                        <p className="text-sm font-semibold text-ferty-dark">{medicalData.promedios.sueno}h</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ferty-gray mb-0.5">Estrés</p>
                        <p className="text-sm font-semibold text-ferty-dark">{medicalData.promedios.estres}/5</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ferty-gray mb-0.5">Agua</p>
                        <p className="text-sm font-semibold text-ferty-dark">{medicalData.promedios.agua} vasos</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ferty-gray mb-0.5">Vegetales</p>
                        <p className="text-sm font-semibold text-ferty-dark">{medicalData.promedios.vegetales} porcs</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-ferty-gray mb-0.5">Días con alcohol</p>
                        <p className="text-sm font-semibold text-ferty-dark">{medicalData.promedios.diasConAlcohol}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notificación discreta si debería actualizar la regla */}
              {shouldUpdatePeriod && (
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
                        setView('TRACKER');
                      }}
                      className="mt-2 text-[10px] font-bold text-amber-700 hover:text-amber-900 underline"
                    >
                      Actualizar ahora →
                    </button>
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

// Memoize ProfileView with custom comparison function
export default React.memo(ProfileView, (prevProps, nextProps) => {
  // Compare props that should trigger re-render
  return (
    prevProps.user?.id === nextProps.user?.id &&
    prevProps.user?.name === nextProps.user?.name &&
    prevProps.user?.methodStartDate === nextProps.user?.methodStartDate &&
    prevProps.logs.length === nextProps.logs.length &&
    prevProps.submittedForms.length === nextProps.submittedForms.length &&
    prevProps.scores.total === nextProps.scores.total
  );
});

