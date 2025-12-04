import { useMemo, useEffect, useRef, useState } from 'react';
import { Award, Check, Edit2, FileText, LogOut, AlertCircle, X, Download, Loader2, ChevronDown, ChevronUp, CheckCircle, Clock, Camera } from 'lucide-react';
import { AppNotification, ConsultationForm, DailyLog, UserProfile, AdminReport, NotificationAction, ViewState } from '../../types';
import { FORM_DEFINITIONS } from '../../constants/formDefinitions';
import { NotificationList } from '../../components/NotificationSystem';
import { generarDatosInformeMedico } from '../../services/MedicalReportHelpers';
import { calcularDiaDelCiclo, calcularFechaInicioCicloActual } from '../../services/CycleCalculations';
import { updateConsultationFormById, updateProfileForUser } from '../../services/userDataService';
import { supabase } from '../../services/supabase';
import { formatDate } from '../../services/utils';
import { useMethodProgress } from '../../hooks/useMethodProgress';
import { calculateCurrentMonthsTrying, setTimeTryingStart } from '../../services/timeTryingService';
import { PILLAR_ICONS } from '../../constants/api';
import { savePillarForm } from '../../services/pillarService';
import { ExamScanner } from '../../components/forms/ExamScanner';

type PillarFormType = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

const PILLAR_TABS: { id: PillarFormType; label: string; iconUrl: string; accent: string }[] = [
  { id: 'FUNCTION', label: 'Function', iconUrl: PILLAR_ICONS.FUNCTION, accent: '#C7958E' },
  { id: 'FOOD', label: 'Food', iconUrl: PILLAR_ICONS.FOOD, accent: '#B67977' },
  { id: 'FLORA', label: 'Flora', iconUrl: PILLAR_ICONS.FLORA, accent: '#6F8A6E' },
  { id: 'FLOW', label: 'Flow', iconUrl: PILLAR_ICONS.FLOW, accent: '#5B7A92' }
];

const LEGACY_FORM_MAP: Record<'F1' | 'F2' | 'F3', PillarFormType> = {
  F1: 'FUNCTION',
  F2: 'FOOD',
  F3: 'FLOW'
};

const findSubmission = (forms: ConsultationForm[], type: PillarFormType) => {
  const matching = forms.filter(form => form.form_type === type || LEGACY_FORM_MAP[form.form_type as keyof typeof LEGACY_FORM_MAP] === type);
  // Return the most recent one (last submitted)
  return matching.sort((a, b) => {
    const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
    return dateB - dateA;
  })[0];
};

interface ProfileHeaderProps {
  user: UserProfile;
  logs: DailyLog[];
  logsCount: number;
  scores: { total: number; function: number; food: number; flora: number; flow: number };
  submittedForms: ConsultationForm[];
}

const ProfileHeader = ({ user, logs, logsCount, scores, submittedForms }: ProfileHeaderProps) => {
  // Calcular día y semana usando hook compartido (consistente con DashboardView)
  const { displayDay, displayWeek, isStarted, isCompleted } = useMethodProgress(user.methodStartDate);

  const level = logsCount > 30 ? 'Experta' : logsCount > 7 ? 'Comprometida' : 'Iniciada';

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
  const [profileTab, setProfileTab] = useState<'PROFILE' | 'HISTORIA'>('HISTORIA');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [isEditingF0, setIsEditingF0] = useState(false);
  const [f0Answers, setF0Answers] = useState<Record<string, any>>({});
  const [isF0Expanded, setIsF0Expanded] = useState(false);
  
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedAllHistory, setHasLoadedAllHistory] = useState(false);

  // Estados para pilares
  const [formType, setFormType] = useState<PillarFormType>('FUNCTION');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [pillarScannerOpen, setPillarScannerOpen] = useState(false);
  const [pillarExamType, setPillarExamType] = useState<
    'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio' | 'other'
  >('hormonal');
  const [pillarExamName, setPillarExamName] = useState('');
  const originalAnswers = useRef<Record<string, any>>({});
  const autoSaveTimeoutPillarRef = useRef<NodeJS.Timeout | null>(null);
  
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

    const updateResult = await updateProfileForUser(user.id, { name: editName });
    if (updateResult.success === false) {
      showNotif(updateResult.error || 'No pudimos actualizar tu nombre', 'error');
      return;
    }
    setUser({ ...user, name: editName });
    setIsEditingProfile(false);
    showNotif('Perfil actualizado correctamente', 'success');
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
      } catch (error: any) {
        showNotif(error?.message || 'Error al guardar F0', 'error');
        return;
      }
    }

    const updates: Partial<UserProfile> = {};
    // También permitimos actualizar el nombre desde la edición de F0
    if (editName && editName !== user.name) {
      updates.name = editName;
    }
    if (f0Answers['q2_weight']) updates.weight = parseFloat(f0Answers['q2_weight']);
    if (f0Answers['q2_height']) updates.height = parseFloat(f0Answers['q2_height']);
    if (f0Answers['q4_objective']) updates.mainObjective = f0Answers['q4_objective'];
    // Nota: lastPeriodDate ya no se guarda en F0, se maneja desde TrackerView
    if (f0Answers['q6_cycle']) updates.cycleLength = parseFloat(f0Answers['q6_cycle']) || parseInt(f0Answers['q6_cycle']);

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
      const profileUpdates: any = {};
      if (updates.name !== undefined) profileUpdates.name = updates.name;
      if (updates.weight !== undefined) profileUpdates.weight = updates.weight;
      if (updates.height !== undefined) profileUpdates.height = updates.height;
      if (updates.mainObjective !== undefined) profileUpdates.main_objective = updates.mainObjective;
      if (updates.cycleLength !== undefined) profileUpdates.cycle_length = updates.cycleLength;
      
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
      if (question.defaultValue !== undefined) {
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
      if (question.defaultValue !== undefined) {
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
    definition.sections.forEach((section: any, index: number) => {
      initialState[section.id] = index === 0;
    });
    setOpenSections(initialState);
  }, [definition]);

  useEffect(() => {
    if (!definition) return;
    if (submittedForm) {
      const loaded: Record<string, any> = {};
      if (Array.isArray(submittedForm.answers)) {
        submittedForm.answers.forEach(answer => {
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
      const defaults: Record<string, any> = {};
      definition.questions?.forEach(question => {
        if (question.defaultValue !== undefined) {
          defaults[question.id] = question.defaultValue;
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
      if (question.optional) return false;
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
      showNotif('Formulario guardado correctamente.', 'success');
      fetchUserForms(user.id);
    } else {
      showNotif(result.error || 'Error al guardar el formulario', 'error');
    }
  };

  const updateAnswer = (id: string, value: any) => setAnswers(prev => ({ ...prev, [id]: value }));

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleDataExtracted = (data: Record<string, any>) => {
    setAnswers(prev => ({ ...prev, ...data }));
    showNotif('Datos extraídos correctamente. Revisa y confirma los valores.', 'success');
  };

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
          const isActive = answers[question.id] === optionValue;
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
        const isActive = answers[question.id] === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => updateAnswer(question.id, option)}
            className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all ${
              isActive ? 'bg-[#95706B] text-white border-[#95706B]' : 'text-[#5D7180] border-[#E1D7D3] hover:bg-[#F4F0ED]'
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
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#95706B]">
          <span>Nivel: {answers[question.id] ?? min}</span>
          <span className="text-[#BBA49E]">0 – {max}</span>
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
                    ? 'bg-[#C7958E] border-[#C7958E]'
                    : 'bg-[#F4F0ED] border-[#E1D7D3] hover:bg-[#E1D7D3]'
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderControl = (question: any) => {
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
              value={answers[`${question.id}_otro`] || ''}
              placeholder="Especifica..."
              onChange={event => updateAnswer(`${question.id}_otro`, event.target.value)}
              className="w-full border border-[#F4F0ED] rounded-2xl p-3 text-sm bg-[#F9F6F4] focus:border-[#C7958E]"
            />
          )}
        </div>
      );
    }

    if (question.type === 'textarea') {
      return (
        <textarea
          value={answers[question.id] || ''}
          className="w-full border border-[#F4F0ED] rounded-2xl p-3 text-sm bg-[#F9F6F4] focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E]"
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
          className="w-full border border-[#F4F0ED] rounded-2xl p-3 text-sm bg-white focus:border-[#C7958E]"
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
          className="w-full border border-[#F4F0ED] rounded-2xl p-3 text-sm bg-[#F9F6F4] focus:border-[#C7958E]"
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
        className="w-full border border-[#F4F0ED] rounded-2xl p-3 text-sm bg-[#F9F6F4] focus:border-[#C7958E]"
      />
    );
  };

  const renderFunctionForm = () => {
    if (!definition || !('sections' in definition) || !definition.sections) return null;
    return (
    <div className="space-y-4">
      {definition.sections.map(section => {
        const isOpen = openSections[section.id];
        return (
          <div key={section.id} className="bg-white border border-[#F4F0ED] rounded-3xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <p className="text-sm font-bold text-[#4A4A4A]">{section.title}</p>
              </div>
              <div className="flex items-center gap-3">
                {!section.optional && (
                  <span className="text-[10px] px-3 py-1 rounded-full bg-[#F4F0ED] text-[#95706B] font-bold">Obligatorio</span>
                )}
                <ChevronDown className={`text-[#95706B] transition-transform ${isOpen ? 'rotate-180' : ''}`} size={18} />
              </div>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 space-y-4">
                {section.fields.map(field => {
                  const question = { ...field, text: field.label };
                  return (
                    <div key={field.id} className="bg-[#F9F6F4] border border-[#F4F0ED] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider">{field.label}</p>
                          {(field.recommendedValue || field.averageValue) && (
                            <p className="text-[10px] text-[#5D7180] mt-0.5">
                              {field.recommendedValue ? `Valor recomendado: ${field.recommendedValue}` : `Valor promedio: ${field.averageValue}`}
                            </p>
                          )}
                        </div>
                        {field.unit && <span className="text-[10px] text-[#95706B]/80 font-semibold ml-2">{field.unit}</span>}
                      </div>
                      {renderControl(question)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
  };

  const renderGeneralForm = () => (
    <div className="space-y-4">
      {definition.questions.map(question => (
        <div key={question.id} className="bg-[#F9F6F4] border border-[#F4F0ED] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#4A4A4A] uppercase tracking-wider">{question.text}</label>
            {question.unit && <span className="text-[11px] text-[#95706B] font-semibold">{question.unit}</span>}
          </div>
          {renderControl(question)}
        </div>
      ))}
    </div>
  );

  const renderFormCard = () => {
    const currentTab = PILLAR_TABS.find(tab => tab.id === formType);
    return (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
        <div className="flex items-center justify-between mb-6 border-b border-[#F4F0ED] pb-4">
          <div className="flex items-center gap-3 flex-1">
            {currentTab && (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${currentTab.accent}1A` }}>
                  <img src={currentTab.iconUrl} alt={`${currentTab.label} icono`} className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[#4A4A4A]">{currentTab.label}</h4>
                  {submittedForm?.submitted_at && (
                    <div className="mt-0.5">
                      <p className="text-xs font-semibold text-[#5D7180]">Última Actualización:</p>
                      <p className="text-xs text-[#5D7180]">{formatDate(submittedForm.submitted_at, 'long')}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {submittedForm && (
            <>
              {isEditMode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="text-[#95706B] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                    title="Cancelar"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={handlePillarSubmit}
                    className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
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
                  className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                  title="Editar formulario"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </>
          )}
        </div>
        {formType === 'FUNCTION' ? renderFunctionForm() : renderGeneralForm()}
        <button onClick={handlePillarSubmit} className="w-full bg-[#5D7180] text-white py-4 rounded-xl font-bold shadow-lg mt-8 hover:bg-[#4A5568] transition-all flex items-center justify-center gap-2">
          Guardar y enviar <Download size={16} />
        </button>
      </div>
    );
  };

  const renderSubmittedView = () => {
    const currentTab = PILLAR_TABS.find(tab => tab.id === formType);
    
    const renderFunctionSubmittedView = () => {
      if (!definition || !('sections' in definition) || !definition.sections || !submittedForm?.answers) return null;
      
      return (
        <div className="space-y-4">
          {definition.sections.map(section => {
            const sectionAnswers = submittedForm.answers.filter((answer: any) => 
              section.fields.some(field => field.id === answer.questionId)
            );
            
            if (sectionAnswers.length === 0) return null;
            
            return (
              <div key={section.id} className="bg-white border border-[#F4F0ED] rounded-3xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-[#F9F6F4] border-b border-[#F4F0ED]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#4A4A4A]">{section.title}</p>
                    {!section.optional && (
                      <span className="text-[10px] px-3 py-1 rounded-full bg-[#F4F0ED] text-[#95706B] font-bold">Obligatorio</span>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    {sectionAnswers.map((answer: any) => {
                      const field = section.fields.find(f => f.id === answer.questionId);
                      return (
                        <div key={answer.questionId} className="bg-[#F4F0ED]/50 p-3 rounded-xl">
                          <p className="text-[11px] uppercase font-bold text-[#95706B] mb-1">{answer.question}</p>
                          <p className={`text-sm font-medium ${!answer.answer ? 'text-stone-400 italic' : 'text-[#4A4A4A]'}`}>
                            {Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer || 'Sin respuesta'}
                            {(field as any)?.unit && answer.answer && (
                              <span className="text-[10px] text-[#95706B]/80 ml-1">{(field as any).unit}</span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    };
    
    return (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
        <div className="flex items-center justify-between mb-4 border-b border-[#F4F0ED] pb-4">
          <div className="flex items-center gap-3 flex-1">
            {currentTab && (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${currentTab.accent}1A` }}>
                  <img src={currentTab.iconUrl} alt={`${currentTab.label} icono`} className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[#4A4A4A]">{currentTab.label}</h4>
                  {submittedForm?.submitted_at && (
                    <div className="mt-0.5">
                      <p className="text-xs font-semibold text-[#5D7180]">Última Actualización:</p>
                      <p className="text-xs text-[#5D7180]">{formatDate(submittedForm.submitted_at, 'long')}</p>
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
                className="text-[#95706B] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
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
              className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
              title={isEditMode ? "Guardar" : "Editar formulario"}
            >
              {isEditMode ? <Check size={16} /> : <Edit2 size={16} />}
            </button>
          </div>
        </div>
        
        {formType === 'FUNCTION' ? (
          renderFunctionSubmittedView()
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(submittedForm?.answers || []).map((answer: any) => (
              <div key={answer.questionId} className="bg-[#F4F0ED]/50 p-3 rounded-xl">
                <p className="text-[11px] uppercase font-bold text-[#95706B] mb-1">{answer.question}</p>
                <p className={`text-sm font-medium ${!answer.answer ? 'text-stone-400 italic' : 'text-[#4A4A4A]'}`}>
                  {Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer || 'Sin respuesta'}
                </p>
              </div>
            ))}
          </div>
        )}
        {submittedForm?.status === 'pending' && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3">
            <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
              <Clock size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-yellow-800">En revisión</p>
              <p className="text-[11px] text-yellow-700 mt-1">Recibirás una notificación cuando el equipo cargue tu informe.</p>
            </div>
          </div>
        )}
        {submittedForm?.status === 'reviewed' && submittedForm.generated_pdf_url && (
          <div className="mt-6 bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
            <p className="text-sm font-bold text-emerald-700 mb-2">¡Informe listo!</p>
            <a
              href={submittedForm.generated_pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-700 transition-colors"
            >
              <Download size={16} /> Descargar PDF
            </a>
          </div>
        )}
      </div>
    );
  };

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
            onClick={() => setProfileTab('HISTORIA')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${profileTab === 'HISTORIA'
              ? 'bg-[#C7958E] text-white shadow-md'
              : 'text-[#5D7180] hover:bg-[#F4F0ED]'}`}
          >
            Historia
          </button>
          <button
            onClick={() => setProfileTab('PROFILE')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${profileTab === 'PROFILE'
              ? 'bg-[#C7958E] text-white shadow-md'
              : 'text-[#5D7180] hover:bg-[#F4F0ED]'}`}
          >
            Mi Perfil
          </button>
        </div>

        {profileTab === 'PROFILE' && (() => {
          const f0Form = submittedForms.find(f => f.form_type === 'F0');
          return (
            <div className="space-y-6">
              {/* Ficha personal (F0) - SIEMPRE mostrar si existe o si está editando */}
              {!f0Form && !isEditingF0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-stone-200 text-center">
                <FileText size={48} className="mx-auto text-stone-300 mb-4" />
                <p className="text-stone-400 text-sm">Aún no has completado el formulario F0</p>
                <button
                  onClick={() => {
                    setIsEditingF0(true);
                    // Inicializar con valores por defecto si no existe
                    const defaults: Record<string, any> = {};
                    FORM_DEFINITIONS.F0.questions.forEach(question => {
                      if ((question as any).defaultValue !== undefined) {
                        defaults[question.id] = (question as any).defaultValue;
                      }
                    });
                    setF0Answers(defaults);
                    originalF0Answers.current = JSON.parse(JSON.stringify(defaults));
                  }}
                  className="mt-4 bg-[#C7958E] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#95706B] transition-colors"
                >
                  Completar F0
                </button>
              </div>
            ) : (f0Form || isEditingF0) ? (
                <div className="space-y-4">
                  {isEditingF0 ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-[#F4F0ED] overflow-hidden">
                      {/* Header con título y botones cuando está editando */}
                      <div className="p-6 flex items-center justify-between border-b border-[#F4F0ED]">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-[#C7958E] mb-1">{FORM_DEFINITIONS.F0.title}</h3>
                          <p className="text-xs text-[#5D7180]">
                            {FORM_DEFINITIONS.F0.description}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setF0Answers(JSON.parse(JSON.stringify(originalF0Answers.current)));
                              setIsEditingF0(false);
                              if (autoSaveTimeoutRef.current) {
                                clearTimeout(autoSaveTimeoutRef.current);
                                autoSaveTimeoutRef.current = null;
                              }
                            }}
                            className="text-[#95706B] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() => {
                              const currentF0Form = submittedForms.find(f => f.form_type === 'F0');
                              handleF0Save(currentF0Form);
                            }}
                            className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                            title="Guardar"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-6">
                      {/* Bloque superior para datos básicos: Nombre, Email y Fecha de nacimiento en una sola columna */}
                      <div className="space-y-4 mb-6">
                        <div className="border-b border-[#F4F0ED] pb-3">
                          <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Nombre</p>
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="w-full text-sm text-[#4A4A4A] border-b border-[#C7958E] focus:outline-none py-1 bg-transparent"
                          />
                        </div>
                        <div className="border-b border-[#F4F0ED] pb-3">
                          <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Email</p>
                          <p className="text-sm text-[#4A4A4A] opacity-70">
                            {user.email} <span className="text-[10px] italic">(No editable)</span>
                          </p>
                        </div>
                        <div className="border-b border-[#F4F0ED] pb-3">
                          <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">
                            Fecha de nacimiento
                          </p>
                          <input
                            type="date"
                            value={f0Answers['q1_birthdate'] || ''}
                            className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-[#F4F0ED]/30 focus:border-[#C7958E] outline-none transition-all"
                            onChange={e => setF0Answers({ ...f0Answers, q1_birthdate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        {FORM_DEFINITIONS.F0.questions.map(q => {
                          // La fecha de nacimiento se gestiona en el bloque superior junto con nombre y email
                          if (q.id === 'q1_birthdate') return null;

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
                                <button
                                  onClick={() => handleAdjust(-1)}
                                  className="w-10 h-10 rounded-2xl border border-[#E1D7D3] text-[#95706B] font-bold text-lg bg-white hover:bg-[#F4F0ED]"
                                  type="button"
                                >
                                  -
                                </button>
                                <div className="flex-1 text-center bg-[#F9F6F4] border border-[#F4F0ED] rounded-2xl py-2">
                                  <p className="text-lg font-bold text-[#4A4A4A]">
                                    {numericValue !== undefined && !Number.isNaN(numericValue) ? numericValue : '—'}
                                  </p>
                                  {question.unit && (
                                    <p className="text-[11px] text-[#95706B] font-semibold">{question.unit}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleAdjust(1)}
                                  className="w-10 h-10 rounded-2xl border border-[#E1D7D3] text-[#95706B] font-bold text-lg bg-white hover:bg-[#F4F0ED]"
                                  type="button"
                                >
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
                            const values =
                              question.options || Array.from({ length: max - min + 1 }, (_, index) => min + index);
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
                                        isActive
                                          ? 'bg-[#C7958E] text-white border-[#C7958E]'
                                          : 'text-[#5D7180] border-[#E1D7D3] hover:bg-[#F4F0ED]'
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
                                      isActive
                                        ? 'bg-[#C7958E] text-white border-[#C7958E]'
                                        : 'text-[#5D7180] border-[#E1D7D3] hover:bg-[#F4F0ED]'
                                    }`}
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          );

                          return (
                            <div key={q.id}>
                              <label className="block text-xs font-bold text-[#4A4A4A] mb-2 uppercase tracking-wide">
                                {q.text}
                              </label>
                              {q.type === 'textarea' ? (
                                <textarea
                                  value={f0Answers[q.id] || ''}
                                  className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm h-28 bg-[#F4F0ED]/30 focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E] outline-none transition-all"
                                  onChange={e => updateAnswer(q.id, e.target.value)}
                                  maxLength={
                                    q.id === 'q9_diagnoses' || q.id === 'q21_family_history' ? 280 : undefined
                                  }
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
                              ) : q.type === 'slider' ? (
                                renderSliderControl(q)
                              ) : q.type === 'stepper' ? (
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
                        onClick={() => {
                          const currentF0Form = submittedForms.find(f => f.form_type === 'F0');
                          handleF0Save(currentF0Form);
                        }}
                        className="w-full bg-[#5D7180] text-white py-4 rounded-xl font-bold shadow-lg mt-8 hover:bg-[#4A5568] transition-all flex items-center justify-center gap-2"
                      >
                        Guardar cambios
                      </button>
                      </div>
                    </div>
                  ) : f0Form ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-[#F4F0ED] overflow-hidden">
                      {/* Header clickeable del desplegable */}
                      <div className="p-6 flex items-center justify-between">
                        <button
                          onClick={() => setIsF0Expanded(!isF0Expanded)}
                          className="flex-1 text-left hover:opacity-80 transition-opacity"
                        >
                          <h3 className="font-bold text-lg text-[#C7958E] mb-1">{FORM_DEFINITIONS.F0.title}</h3>
                          <p className="text-xs text-[#5D7180]">
                            {FORM_DEFINITIONS.F0.description}
                          </p>
                          {f0Form && (
                            <div className="mt-2 space-y-0.5">
                              <p className="text-[10px] text-[#5D7180]">
                                Registrado: {formatDate(f0Form.submitted_at || new Date().toISOString(), 'long')}
                              </p>
                              {f0Form.pdf_generated_at && (
                                <p className="text-[10px] text-[#5D7180]">
                                  Última actualización: {formatDate(f0Form.pdf_generated_at, 'long')}
                                </p>
                              )}
                            </div>
                          )}
                        </button>
                        <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentF0Form = submittedForms.find(f => f.form_type === 'F0');
                              if (!currentF0Form) return;

                              const initialAnswers: Record<string, any> = {};
                              currentF0Form.answers.forEach((a: any) => {
                                initialAnswers[a.questionId] = a.answer;
                              });

                              if (user?.cycleLength) {
                                initialAnswers['q6_cycle'] = user.cycleLength;
                              }

                              originalF0Answers.current = JSON.parse(JSON.stringify(initialAnswers));
                              setF0Answers(initialAnswers);
                              setIsEditingF0(true);
                            }}
                            className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setIsF0Expanded(!isF0Expanded)}
                            className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                            title={isF0Expanded ? 'Colapsar' : 'Expandir'}
                          >
                            {isF0Expanded ? (
                              <ChevronUp size={20} />
                            ) : (
                              <ChevronDown size={20} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Contenido desplegable */}
                      {isF0Expanded && (
                        <div className="px-6 pb-6 border-t border-[#F4F0ED] pt-6">
                          {/* Bloque superior para datos básicos: Nombre, Email y Fecha de nacimiento */}
                          <div className="space-y-4 mb-6">
                            <div className="border-b border-[#F4F0ED] pb-3">
                              <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Nombre</p>
                              <p className="text-sm text-[#4A4A4A]">{user.name}</p>
                            </div>
                            <div className="border-b border-[#F4F0ED] pb-3">
                              <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Email</p>
                              <p className="text-sm text-[#4A4A4A] opacity-70">
                                {user.email} <span className="text-[10px] italic">(No editable)</span>
                              </p>
                            </div>
                            <div className="border-b border-[#F4F0ED] pb-3">
                              <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">
                                Fecha de nacimiento
                              </p>
                              <p className="text-sm text-[#4A4A4A]">
                                {(() => {
                                  const birthdateAnswer = f0Form.answers?.find(a => a.questionId === 'q1_birthdate')?.answer;
                                  return birthdateAnswer 
                                    ? formatDate(birthdateAnswer as string, 'long')
                                    : '—';
                                })()}
                              </p>
                            </div>
                          </div>

                          {/* Mostrar todos los campos del formulario F0 en modo lectura */}
                          <div className="space-y-6">
                            {FORM_DEFINITIONS.F0.questions.map(q => {
                              // La fecha de nacimiento se gestiona en el bloque superior
                              if (q.id === 'q1_birthdate') return null;

                              const answer = f0Form.answers?.find(a => a.questionId === q.id);
                              const value = answer?.answer ?? null;

                              // Formatear el valor para mostrar
                              let displayValue: string | null = null;
                              if (value !== null && value !== undefined && value !== '') {
                                if (q.type === 'date' && typeof value === 'string') {
                                  displayValue = formatDate(value, 'long');
                                } else if (Array.isArray(value)) {
                                  displayValue = value.join(', ');
                                } else if (typeof value === 'number' && (q as any).unit) {
                                  displayValue = `${value} ${(q as any).unit}`;
                                } else {
                                  displayValue = String(value);
                                }
                              }

                              return (
                                <div key={q.id} className="border-b border-[#F4F0ED] pb-3 last:border-0">
                                  <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">{q.text}</p>
                                  <p className="text-sm text-[#4A4A4A] whitespace-pre-line">
                                    {displayValue ?? '—'}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

            {/* Bloques de Pilares (Function, Food, Flora, Flow) */}
            <div>
              <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Pilares FertyFit</h3>
              <p className="text-xs text-[#5D7180] mb-4">Completa los formularios de cada pilar para un análisis completo.</p>
              
              {/* Pestañas de pilares */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {PILLAR_TABS.map(tab => {
                  const hasData = Boolean(findSubmission(submittedForms, tab.id));
                  const isActive = formType === tab.id;
                  const pillarProgress = getPillarProgress(tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFormType(tab.id)}
                      className={`rounded-3xl border px-4 py-4 text-left transition-all shadow-sm ${
                        isActive ? 'border-[#C7958E] bg-white shadow-lg' : 'border-[#F4F0ED] bg-[#F9F6F4] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-[#4A4A4A]">{tab.label}</p>
                        {hasData && (
                          <CheckCircle size={14} className="text-emerald-600" />
                        )}
                      </div>
                      {pillarProgress > 0 && (
                        <div className="w-full bg-[#F4F0ED] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#C7958E] to-[#95706B] transition-all duration-500 rounded-full"
                            style={{ width: `${pillarProgress}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="bg-[#F9F6F4] px-4 py-2.5 rounded-xl border border-[#F4F0ED] mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold text-[#5D7180]">Progreso</p>
                  <p className="text-[10px] font-bold text-[#95706B]">{progress.percentage}%</p>
                </div>
                <div className="w-full bg-[#F4F0ED] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#C7958E] to-[#95706B] transition-all duration-500 rounded-full"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                {progress.percentage === 100 && (
                  <p className="text-[9px] text-[#5D7180] mt-1.5 text-center">
                    Puedes editarlo si surge algún cambio
                  </p>
                )}
              </div>

              {/* Formulario del pilar seleccionado */}
              {submittedForm && !isEditMode
                ? renderSubmittedView()
                : renderFormCard()}
            </div>

            {/* Exam Scanner Modal para pilares */}
            {pillarScannerOpen && (
              <ExamScanner
                examType={
                  pillarExamType === 'other'
                    ? undefined
                    : (pillarExamType as 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio')
                }
                onDataExtracted={handleDataExtracted}
                onClose={() => {
                  setPillarScannerOpen(false);
                  setPillarExamName('');
                }}
                sectionTitle={pillarExamType === 'other' ? pillarExamName || 'Examen' : undefined}
                autoDetect={pillarExamType === 'other'}
                examName={pillarExamType === 'other' ? pillarExamName : undefined}
              />
            )}

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
          const medicalData = generarDatosInformeMedico(user, logs);
          return (
            <div className="space-y-4">
              {/* Bloque de Salud General, Hábitos y Análisis de Edad movido desde Mi Perfil */}
              {medicalData && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F4F0ED] space-y-4">
                  <div className="border-b border-[#F4F0ED] pb-3">
                    <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-2">Salud General</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-[#5D7180] mb-0.5">Edad</p>
                        <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.edad} años</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#5D7180] mb-0.5">Peso</p>
                        <p className="text-sm font-semibold text-[#4A4A4A]">{medicalData.pesoActual} kg</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#5D7180] mb-0.5">Altura</p>
                        <p className="text-sm font-semibold text-[#4A4A4A]">
                          {typeof user.height === 'number' ? `${user.height} cm` : user.height ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#5D7180] mb-0.5">IMC</p>
                        <p className="text-sm font-semibold text-[#4A4A4A]">
                          {medicalData.imc.valor} ({medicalData.imc.categoria})
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-[#5D7180] mb-0.5">Peso ideal</p>
                        <p className="text-sm font-semibold text-[#4A4A4A]">
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
                    const cycleLength = getAnswer('q6_cycle');
                    const regularity = getAnswer('q7_regularity');
                    const objective = getAnswer('q4_objective');
                    const partner = getAnswer('q5_partner');
                    const timeTrying = getAnswer('q3_time_trying');
                    const treatments = getAnswer('q20_fertility_treatments');
                    const diagnoses = getAnswer('q9_diagnoses');
                    const familyHistory = getAnswer('q21_family_history');

                    const renderField = (label: string, value: any) => (
                      <div className="border-b border-[#F4F0ED] pb-3 last:border-0">
                        <p className="text-[11px] text-[#5D7180] mb-0.5">{label}</p>
                        <p className="text-sm font-semibold text-[#4A4A4A]">
                          {value ?? '—'}
                        </p>
                      </div>
                    );

                    return (
                      <>
                        {/* CICLO Y OBJETIVO (en Historia, en dos columnas) */}
                        <div className="border-b border-[#F4F0ED] pb-3">
                          <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-2">
                            CICLO Y OBJETIVO
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            {renderField(
                              'Duración ciclo promedio',
                              typeof cycleLength === 'number' ? `${cycleLength} días` : cycleLength
                            )}
                            {renderField('¿Ciclos regulares?', regularity)}
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
                          <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-2">
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
                    <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-2">Análisis de Edad</p>
                    <p className="text-sm font-semibold text-[#4A4A4A] mb-1">
                      {medicalData.analisisEdad.categoria} - {medicalData.analisisEdad.probabilidad}
                    </p>
                    <p className="text-[10px] text-[#5D7180]">{medicalData.analisisEdad.mensaje}</p>
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

              {/* Eliminado: segundo bloque de Ficha Personal */}

              {/* Bloque de notificaciones */}
              <div className="mt-6">
                <NotificationList
                  notifications={visibleNotifications}
                  onMarkRead={markNotificationRead}
                  deleteNotification={deleteNotification}
                  onAction={onNotificationAction}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ProfileView;

