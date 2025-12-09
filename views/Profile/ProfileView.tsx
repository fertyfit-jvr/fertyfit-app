import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Award, Check, Edit2, FileText, LogOut, AlertCircle, X, Download, Loader2, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { AppNotification, ConsultationForm, DailyLog, UserProfile, NotificationAction, ViewState, FormAnswer, isAINotification } from '../../types';

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
import { FORM_DEFINITIONS, FUNCTION_SECTIONS } from '../../constants/formDefinitions';
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
  
  // Estados para analíticas
  const [expandedExamAnswers, setExpandedExamAnswers] = useState<Record<number, boolean>>({});
  const [visibleExamFormsCount, setVisibleExamFormsCount] = useState(3);
  const [editingExamId, setEditingExamId] = useState<number | null>(null);
  const [editingExamAnswers, setEditingExamAnswers] = useState<Record<number, FormAnswer[]>>({});
  
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
  
  // Refs para auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutPillarRef = useRef<NodeJS.Timeout | null>(null);
  const originalAnswers = useRef<FormAnswersDict>({});
  const originalF0Answers = useRef<FormAnswersDict>({});

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

  // Funciones para manejar analíticas
  const handleDeleteExam = async (examFormId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta analítica?')) return;
    
    try {
      const { error } = await supabase
        .from('consultation_forms')
        .delete()
        .eq('id', examFormId);
      
      if (error) throw error;
      
      showNotif('Analítica eliminada correctamente', 'success');
      await fetchUserForms(user.id);
    } catch (error) {
      showNotif('Error al eliminar la analítica', 'error');
      console.error('Error deleting exam:', error);
    }
  };

  const handleEditExam = (examForm: ConsultationForm) => {
    // Activar modo edición inline
    setEditingExamId(examForm.id);
    // Guardar una copia de las respuestas para editar
    const answersCopy = examForm.answers ? [...examForm.answers] : [];
    setEditingExamAnswers(prev => ({ ...prev, [examForm.id]: answersCopy }));
  };

  const handleCancelEditExam = (examFormId: number) => {
    setEditingExamId(null);
    setEditingExamAnswers(prev => {
      const newState = { ...prev };
      delete newState[examFormId];
      return newState;
    });
  };

  const handleSaveExam = async (examForm: ConsultationForm) => {
    if (!editingExamAnswers[examForm.id]) return;

    try {
      const { error } = await supabase
        .from('consultation_forms')
        .update({
          answers: editingExamAnswers[examForm.id],
          updated_at: new Date().toISOString()
        })
        .eq('id', examForm.id);

      if (error) throw error;

      showNotif('Analítica actualizada correctamente', 'success');
      setEditingExamId(null);
      setEditingExamAnswers(prev => {
        const newState = { ...prev };
        delete newState[examForm.id];
        return newState;
      });
      await fetchUserForms(user.id);
    } catch (error) {
      showNotif('Error al actualizar la analítica', 'error');
      console.error('Error updating exam:', error);
    }
  };

  const handleUpdateExamAnswer = (examFormId: number, questionId: string, value: any) => {
    setEditingExamAnswers(prev => {
      const answers = prev[examFormId] || [];
      const updatedAnswers = answers.map(answer =>
        answer.questionId === questionId ? { ...answer, answer: value } : answer
      );
      return { ...prev, [examFormId]: updatedAnswers };
    });
  };

  // Función para encontrar formulario enviado
  const findSubmission = (forms: ConsultationForm[], type: PillarFormType) => {
    const matching = forms.filter(form => {
      const typeMatches = form.form_type === type || LEGACY_FORM_MAP[form.form_type as keyof typeof LEGACY_FORM_MAP] === type;
      if (!typeMatches) return false;
      
      if (type === 'FUNCTION' && form.answers && Array.isArray(form.answers)) {
        const hasExamType = form.answers.some((a: any) => a.questionId === 'exam_type');
        if (hasExamType) return false;
      }
      
      return true;
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
      }> = {};
      if (updates.name !== undefined) profileUpdates.name = updates.name;
      if (updates.weight !== undefined) profileUpdates.weight = updates.weight;
      if (updates.height !== undefined) profileUpdates.height = updates.height;
      if (updates.mainObjective !== undefined) profileUpdates.main_objective = updates.mainObjective;
      
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

  // Calculate progress for current form based on submitted form, not local answers
  const progress = useMemo(() => {
    if (!definition?.questions) return { answered: 0, total: 0, percentage: 0 };
    
    // If no form has been submitted, progress is 0%
    if (!submittedForm || !submittedForm.answers || !Array.isArray(submittedForm.answers)) {
      return { answered: 0, total: definition.questions.length, percentage: 0 };
    }
    
    const totalQuestions = definition.questions.length;
    const answeredQuestions = definition.questions.filter(question => {
      const answer = submittedForm.answers.find((a: any) => a.questionId === question.id);
      if (!answer) return false;
      const value = answer.answer;
      
      // Consider answered if value exists and is not empty string
      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      
      // Ignore values that are exactly equal to the default value (user hasn't actually filled it)
      if ('defaultValue' in question && question.defaultValue !== undefined) {
        // Convert both to strings for comparison to handle number/string mismatches
        const defaultValueStr = String(question.defaultValue);
        const valueStr = String(value);
        if (valueStr === defaultValueStr) return false;
      }
      
      // For Flora "Otra" fields, check if contains ": " (combined format)
      if ((question.id === 'flora_pruebas' || question.id === 'flora_suplementos') && typeof value === 'string' && value.includes(': ')) {
        const [, otherValue] = value.split(': ', 2);
        return Boolean(otherValue && otherValue.trim() !== '');
      }
      
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
    
    const totalQuestions = pillarDef.questions.length;
    const answeredQuestions = pillarDef.questions.filter(question => {
      const answer = form.answers.find((a: any) => a.questionId === question.id);
      if (!answer) return false;
      const value = answer.answer;
      
      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      
      // Ignore values that are exactly equal to the default value (user hasn't actually filled it)
      if ('defaultValue' in question && question.defaultValue !== undefined) {
        const defaultValueStr = String(question.defaultValue);
        const valueStr = String(value);
        if (valueStr === defaultValueStr) return false;
      }
      
      // For Flora "Otra" fields, check if contains ": " (combined format)
      if ((question.id === 'flora_pruebas' || question.id === 'flora_suplementos') && typeof value === 'string' && value.includes(': ')) {
        const [, otherValue] = value.split(': ', 2);
        return Boolean(otherValue && otherValue.trim() !== '');
      }
      
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
          const isActive = answers[question.id] === optionValue;
          return (
            <button
              key={option}
              type="button"
              onClick={() => updateAnswer(question.id, optionValue)}
              className={`px-3 py-2 text-xs font-bold rounded-full border transition-all ${
                isActive ? 'bg-ferty-rose text-white border-ferty-rose' : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
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
            className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all ${
              isActive ? 'bg-ferty-coral text-white border-ferty-coral' : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
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
                className={`flex-1 h-8 rounded-lg border transition-all ${
                  isActive
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

  const renderControl = (question: FormQuestion) => {
    const controlType = question.control ?? question.type;

    // Flow-specific variations - simplified controls
    if (formType === 'FLOW') {
      // Convert some to Yes/No
      if (['flow_soporte'].includes(question.id)) {
        return renderButtons(question, ['Sí', 'No']);
      }

      // Use percentage bars for some
      if (['flow_carga_mental', 'flow_rumiacion', 'flow_alerta', 'flow_presion_social', 'flow_soledad', 'flow_energia_manana', 'flow_energia_tarde', 'flow_sueno_calidad', 'flow_pantallas', 'flow_libido', 'flow_conexion'].includes(question.id)) {
        return renderPercentageControl(question);
      }
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
              value={String(answers[`${question.id}_otro`] || '')}
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
          value={String(answers[question.id] || '')}
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
          value={String(answers[question.id] || '')}
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
          value={String(answers[question.id] || '')}
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
        value={String(answers[question.id] || '')}
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
        {definition.questions.map(question => (
          <div key={question.id} className="bg-ferty-beigeLight border border-ferty-beige rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ferty-dark uppercase tracking-wider">{question.text}</label>
              {question.unit && <span className="text-[11px] text-ferty-coral font-semibold">{question.unit}</span>}
            </div>
            {renderControl(question)}
          </div>
        ))}
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
              // Excluir exam_type y gemini_comment (son de exámenes)
              if (answer.questionId === 'exam_type' || answer.questionId === 'gemini_comment') {
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
            
            // Función helper para renderizar un campo
            const renderField = (label: string, value: any, colSpan: number = 1) => {
              const displayValue = Array.isArray(value) ? value.join(', ') : (value ?? '—');
              const isEmpty = !value || (Array.isArray(value) && value.length === 0);
              
              return (
                <div key={label} className={colSpan === 2 ? 'col-span-2' : ''}>
                  <p className="text-[10px] text-ferty-gray mb-0.5">{label}</p>
                  <p className={`text-sm font-semibold ${isEmpty ? 'text-stone-400 italic' : 'text-ferty-dark'}`}>
                    {isEmpty ? 'Sin respuesta' : displayValue}
                  </p>
                </div>
              );
            };
            
            // Para FUNCTION: agrupar por secciones
            if (formType === 'FUNCTION') {
              const sections = FUNCTION_SECTIONS.map((section) => {
                // Obtener respuestas que pertenecen a esta sección
                const sectionAnswers = filteredAnswers.filter((answer: any) => {
                  return section.fields.some(field => field.id === answer.questionId);
                });
                
                if (sectionAnswers.length === 0) return null;
                
                return (
                  <div key={section.id} className="border-b border-ferty-beige pb-3 last:border-0">
                    <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                      {section.title}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {sectionAnswers.map((answer: any) => {
                        const field = section.fields.find(f => f.id === answer.questionId);
                        const label = field?.label || answer.question;
                        const value = answer.answer;
                        // Si la respuesta es muy larga o es un campo de texto largo, usar col-span-2
                        const isLong = Array.isArray(value) && value.length > 1 || 
                                      (typeof value === 'string' && value.length > 50);
                        return renderField(label, value, isLong ? 2 : 1);
                      })}
                    </div>
                  </div>
                );
              }).filter(Boolean);
              
              // También mostrar campos legacy que no están en secciones
              const legacyAnswers = filteredAnswers.filter((answer: any) => {
                return !FUNCTION_SECTIONS.some(section => 
                  section.fields.some(field => field.id === answer.questionId)
                );
              });
              
              if (legacyAnswers.length > 0) {
                sections.push(
                  <div key="legacy" className="border-b border-ferty-beige pb-3 last:border-0">
                    <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                      Información Adicional
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {legacyAnswers.map((answer: any) => {
                        const label = answer.question;
                        const value = answer.answer;
                        const isLong = Array.isArray(value) && value.length > 1 || 
                                      (typeof value === 'string' && value.length > 50);
                        return renderField(label, value, isLong ? 2 : 1);
                      })}
                    </div>
                  </div>
                );
              }
              
              return sections;
            }
            
            // Para FOOD, FLORA, FLOW: mostrar en una sección general
            return (
              <div className="border-b border-ferty-beige pb-3">
                <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                  {currentTab?.label || 'Formulario'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {filteredAnswers.map((answer: any) => {
                    const question = definition?.questions?.find((q: any) => q.id === answer.questionId);
                    const label = question?.text || answer.question;
                    const value = answer.answer;
                    // Si la respuesta es muy larga, usar col-span-2
                    const isLong = Array.isArray(value) && value.length > 1 || 
                                  (typeof value === 'string' && value.length > 80);
                    return renderField(label, value, isLong ? 2 : 1);
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
        {/* Link discreto para editar perfil */}
        <div className="mb-4 flex justify-end">
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
          // Filtrar solo informes de IA para la vista Historia
          const aiReports = visibleNotifications.filter(n => isAINotification(n.type as string));
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

              {/* Bloque de informes (solo IA) en Historia */}
              {/* ReportsList no disponible en esta versión - comentado temporalmente */}
              {/* <div className="mt-6">
                <ReportsList
                  reports={aiReports}
                  onMarkRead={markNotificationRead}
                  deleteNotification={deleteNotification}
                  onAction={onNotificationAction}
                />
              </div> */}

              {/* Analíticas guardadas */}
              {(() => {
                // Filtrar formularios que son exámenes (tienen exam_type en las respuestas)
                const examForms = submittedForms.filter(form => {
                  if (!form.answers || !Array.isArray(form.answers)) return false;
                  return form.answers.some((a: FormAnswer) => a.questionId === 'exam_type');
                });

                if (examForms.length === 0) return null;

                // Ordenar por fecha más reciente primero
                const sortedExamForms = [...examForms].sort((a, b) => {
                  const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
                  const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
                  return dateB - dateA;
                });

                // Mostrar solo las últimas N analíticas
                const visibleForms = sortedExamForms.slice(0, visibleExamFormsCount);
                const hasMore = sortedExamForms.length > visibleExamFormsCount;

                return (
                  <div className="mt-6">
                    <div className="bg-white border border-ferty-beige rounded-3xl p-4 shadow-sm">
                      <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-3">
                        Analíticas guardadas
                      </p>
                      <div className="space-y-3">
                        {visibleForms.map((examForm) => {
                          const examTypeAnswer = examForm.answers?.find((a: FormAnswer) => a.questionId === 'exam_type');
                          const examType = examTypeAnswer?.answer || 'Examen';
                          const isEditing = editingExamId === examForm.id;
                          const currentAnswers = isEditing && editingExamAnswers[examForm.id] 
                            ? editingExamAnswers[examForm.id] 
                            : examForm.answers || [];
                          
                          // Separar el comentario de validación
                          const commentAnswer = currentAnswers.find((a: FormAnswer) => a.questionId === 'gemini_comment');
                          const examAnswers = currentAnswers.filter((a: FormAnswer) => 
                            a.questionId !== 'exam_type' && a.questionId !== 'gemini_comment'
                          );
                          
                          const isExpanded = expandedExamAnswers[examForm.id] || false;
                          const initialShowCount = 6;
                          const showAll = isExpanded || examAnswers.length <= initialShowCount;

                          return (
                            <div key={examForm.id} className="bg-ferty-beigeLight border border-ferty-beige rounded-2xl p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-ferty-dark">{examType}</p>
                                  <p className="text-[10px] text-ferty-gray">
                                    {examForm.submitted_at ? formatDate(examForm.submitted_at) : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => handleSaveExam(examForm)}
                                        className="p-1.5 text-ferty-rose hover:bg-ferty-beige rounded-lg transition-colors"
                                        title="Guardar"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleCancelEditExam(examForm.id)}
                                        className="p-1.5 text-ferty-coral hover:bg-ferty-beige rounded-lg transition-colors"
                                        title="Cancelar"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleEditExam(examForm)}
                                        className="p-1.5 text-ferty-rose hover:bg-ferty-beige rounded-lg transition-colors"
                                        title="Editar"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteExam(examForm.id)}
                                        className="p-1.5 text-ferty-coral hover:bg-ferty-beige rounded-lg transition-colors"
                                        title="Eliminar"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {(showAll ? examAnswers : examAnswers.slice(0, initialShowCount)).map((answer: FormAnswer) => (
                                  <div key={answer.questionId} className="bg-white p-2 rounded-xl">
                                    <p className="text-[10px] text-ferty-gray mb-0.5">{answer.question}</p>
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={typeof answer.answer === 'object' ? JSON.stringify(answer.answer) : String(answer.answer || '')}
                                        onChange={(e) => handleUpdateExamAnswer(examForm.id, answer.questionId, e.target.value)}
                                        className="w-full text-xs font-semibold text-ferty-dark border border-ferty-beige rounded-lg p-1 focus:border-ferty-rose focus:outline-none"
                                      />
                                    ) : (
                                      <p className="text-xs font-semibold text-ferty-dark">
                                        {typeof answer.answer === 'object' ? JSON.stringify(answer.answer) : String(answer.answer)}
                                      </p>
                                    )}
                                  </div>
                                ))}
                                {examAnswers.length > initialShowCount && !showAll && (
                                  <button
                                    onClick={() => setExpandedExamAnswers(prev => ({ ...prev, [examForm.id]: true }))}
                                    className="col-span-2 text-center py-2 text-[10px] text-ferty-rose hover:text-ferty-coral font-semibold transition-colors"
                                  >
                                    +{examAnswers.length - initialShowCount} valores más
                                  </button>
                                )}
                                {showAll && examAnswers.length > initialShowCount && (
                                  <button
                                    onClick={() => setExpandedExamAnswers(prev => ({ ...prev, [examForm.id]: false }))}
                                    className="col-span-2 text-center py-2 text-[10px] text-ferty-gray hover:text-ferty-dark font-semibold transition-colors"
                                  >
                                    Mostrar menos
                                  </button>
                                )}
                              </div>
                              {/* Campo de comentario en columna completa (solo lectura) */}
                              {commentAnswer && (
                                <div className="mt-3 bg-white p-3 rounded-xl">
                                  <p className="text-[10px] text-ferty-gray mb-1">
                                    {commentAnswer.question.replace(' (Gemini)', '')}
                                  </p>
                                  <p className="text-xs font-semibold text-ferty-dark whitespace-pre-wrap">
                                    {typeof commentAnswer.answer === 'string' ? commentAnswer.answer : String(commentAnswer.answer || '')}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {hasMore && (
                        <button
                          onClick={() => setVisibleExamFormsCount(prev => prev + 3)}
                          className="w-full mt-4 py-2 text-xs text-ferty-rose hover:text-ferty-coral font-semibold transition-colors border border-ferty-beige rounded-xl hover:bg-ferty-beigeLight"
                        >
                          Cargar más analíticas
                        </button>
                      )}
                      {visibleExamFormsCount > 3 && visibleForms.length < sortedExamForms.length && (
                        <button
                          onClick={() => setVisibleExamFormsCount(3)}
                          className="w-full mt-2 py-2 text-xs text-ferty-gray hover:text-ferty-dark transition-colors"
                        >
                          Mostrar menos
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
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

