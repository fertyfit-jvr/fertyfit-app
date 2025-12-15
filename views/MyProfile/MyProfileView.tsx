import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Award, Check, Edit2, FileText, LogOut, AlertCircle, X, Download, Loader2, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { ConsultationForm, DailyLog, UserProfile, ViewState, FormAnswer } from '../../types';

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
import { FORM_DEFINITIONS, FUNCTION_SECTIONS } from '../../constants/formDefinitions';
import { generarDatosInformeMedico } from '../../services/MedicalReportHelpers';
import { calcularDiaDelCiclo } from '../../services/CycleCalculations';
import { updateConsultationFormById, updateProfileForUser } from '../../services/userDataService';
import { supabase } from '../../services/supabase';
import { formatDate } from '../../services/utils';
import { useMethodProgress } from '../../hooks/useMethodProgress';
import { calculateCurrentMonthsTrying, setTimeTryingStart } from '../../services/timeTryingService';
import { PILLAR_ICONS } from '../../constants/api';
import { savePillarForm } from '../../services/pillarService';
import { ExamScanner } from '../../components/forms/ExamScanner';
import ProgressBar from '../../components/common/ProgressBar';

type PillarFormType = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

const PILLAR_TABS: { id: PillarFormType; label: string; iconUrl: string; accent: string }[] = [
  { id: 'FUNCTION', label: 'Function', iconUrl: PILLAR_ICONS.FUNCTION, accent: '#C7958E' },
  { id: 'FOOD', label: 'Food', iconUrl: PILLAR_ICONS.FOOD, accent: '#B67977' },
  { id: 'FLORA', label: 'Flora', iconUrl: PILLAR_ICONS.FLORA, accent: '#6F8A6E' },
  { id: 'FLOW', label: 'Flow', iconUrl: PILLAR_ICONS.FLOW, accent: '#5B7A92' }
];

// Helper para mapear colores de acento a clases de Tailwind con opacidad
const getPillarAccentClass = (accent: string) => {
  const accentMap: Record<string, string> = {
    '#C7958E': 'bg-ferty-rose/10',
    '#B67977': 'bg-ferty-food-accent/10',
    '#6F8A6E': 'bg-ferty-flora-accent/10',
    '#5B7A92': 'bg-ferty-flow-accent/10',
  };
  return accentMap[accent] || 'bg-ferty-rose/10';
};

const LEGACY_FORM_MAP: Record<'F1' | 'F2' | 'F3', PillarFormType> = {
  F1: 'FUNCTION',
  F2: 'FOOD',
  F3: 'FLOW'
};

const findSubmission = (forms: ConsultationForm[], type: PillarFormType) => {
  const matching = forms.filter(form => {
    // Check if form type matches
    const typeMatches = form.form_type === type || LEGACY_FORM_MAP[form.form_type as keyof typeof LEGACY_FORM_MAP] === type;
    if (!typeMatches) return false;
    
    // ⭐ IMPORTANTE: Excluir exámenes médicos (tienen exam_type en las respuestas)
    // Solo para FUNCTION, filtrar los que son exámenes
    if (type === 'FUNCTION' && form.answers && Array.isArray(form.answers)) {
      const hasExamType = form.answers.some((a: any) => a.questionId === 'exam_type');
      if (hasExamType) return false; // Es un examen, no el formulario FUNCTION
    }
    
    return true;
  });
  
  // Return the most recent one (last submitted)
  return matching.sort((a, b) => {
    const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
    return dateB - dateA;
  })[0];
};

interface MyProfileViewProps {
  user: UserProfile;
  logs: DailyLog[];
  submittedForms: ConsultationForm[];
  scores: { total: number; function: number; food: number; flora: number; flow: number };
  showNotif: (msg: string, type: 'success' | 'error') => void;
  setView: (view: ViewState) => void;
  fetchUserForms: (userId: string) => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  fetchAllLogs?: (userId: string) => Promise<DailyLog[]>;
  setLogs?: (logs: DailyLog[]) => void;
  onRestartMethod: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const MyProfileView = ({
  user,
  logs,
  submittedForms,
  scores,
  showNotif,
  setView,
  fetchUserForms,
  setUser,
  onRestartMethod,
  onLogout,
  fetchAllLogs,
  setLogs
}: MyProfileViewProps) => {
  // Estados locales
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [isEditingF0, setIsEditingF0] = useState(false);
  const [f0Answers, setF0Answers] = useState<FormAnswersDict>({});
  const [isF0Expanded, setIsF0Expanded] = useState(false);
  
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedAllHistory, setHasLoadedAllHistory] = useState(false);

  // Estados para pilares
  const [formType, setFormType] = useState<PillarFormType>('FUNCTION');
  const [answers, setAnswers] = useState<FormAnswersDict>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [pillarScannerOpen, setPillarScannerOpen] = useState(false);
  const [pillarExamType, setPillarExamType] = useState<
    'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio' | 'other'
  >('hormonal');
  const [pillarExamName, setPillarExamName] = useState('');
  const originalAnswers = useRef<FormAnswersDict>({});
  const autoSaveTimeoutPillarRef = useRef<NodeJS.Timeout | null>(null);
  
  
  // Guardar valores originales para poder cancelar
  const originalEditName = useRef<string>(user.name);
  const originalF0Answers = useRef<FormAnswersDict>({});
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sincronizar editName cuando cambie el usuario
  useEffect(() => {
    setEditName(user.name);
    originalEditName.current = user.name;
  }, [user.name]);

  // Función local para guardar perfil
  const handleSaveProfile = useCallback(async () => {
    if (!user?.id) return;

    const updateResult = await updateProfileForUser(user.id, { name: editName });
    if (updateResult.success === false) {
      showNotif(updateResult.error || 'No pudimos actualizar tu nombre', 'error');
      return;
    }
    setUser({ ...user, name: editName });
    setIsEditingProfile(false);
    showNotif('Perfil actualizado correctamente', 'success');
  }, [user, editName, showNotif, setUser]);

  const handleProfileEditClick = useCallback(() => {
    if (isEditingProfile) {
      handleSaveProfile();
    } else {
      originalEditName.current = user.name;
      setIsEditingProfile(true);
    }
  }, [isEditingProfile, handleSaveProfile, user.name]);

  const handleProfileCancel = useCallback(() => {
    setEditName(originalEditName.current);
    setIsEditingProfile(false);
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  }, []);

  const handleRestartClick = useCallback(async () => {
    const confirmed = confirm('¿Estás segura de que deseas reiniciar el método?');
    if (!confirmed) return;
    await onRestartMethod();
  }, [onRestartMethod]);

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
    if (f0Answers['q2_weight']) updates.weight = parseFloat(f0Answers['q2_weight']);
    if (f0Answers['q2_height']) updates.height = parseFloat(f0Answers['q2_height']);
    if (f0Answers['q4_objective']) updates.mainObjective = f0Answers['q4_objective'];
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
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getPillarAccentClass(currentTab.accent)}`}>
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
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getPillarAccentClass(currentTab.accent)}`}>
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
      <div className="p-5 pt-0">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-ferty-dark mb-1">Mi Perfil</h2>
          <p className="text-[10px] text-ferty-gray">
            Esta información es la base de tu Método Ferty Fit personalizado.
          </p>
        </div>
        
        {/* Link discreto para volver */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setView('PROFILE')}
            className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
          >
            Volver
          </button>
        </div>
        {(() => {
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
                    const defaults: FormAnswersDict = {};
                    FORM_DEFINITIONS.F0.questions.forEach(question => {
                      if ('defaultValue' in question && question.defaultValue !== undefined) {
                        defaults[question.id] = question.defaultValue as string | number | boolean | string[];
                      }
                    });
                    setF0Answers(defaults);
                    originalF0Answers.current = JSON.parse(JSON.stringify(defaults));
                  }}
                  className="mt-4 bg-ferty-rose text-white px-6 py-3 rounded-xl font-bold hover:bg-ferty-coral transition-colors"
                >
                  Completar F0
                </button>
              </div>
            ) : (f0Form || isEditingF0) ? (
                <div className="space-y-4">
                  {isEditingF0 ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-ferty-beige overflow-hidden">
                      {/* Header con título y botones cuando está editando */}
                      <div className="p-6 flex items-center justify-between border-b border-ferty-beige">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-ferty-dark mb-1">Ficha Personal</h3>
                          <p className="text-xs text-ferty-gray mb-1">
                            Actualiza estos sólo si es necesario
                          </p>
                          {(user?.joinedAt || f0Form?.submitted_at) && (
                            <div className="space-y-0.5">
                              {user?.joinedAt && (
                                <p className="text-[10px] text-ferty-gray">
                                  Fecha de Registro: {formatDate(user.joinedAt, 'long')}
                                </p>
                              )}
                              {f0Form?.submitted_at && (
                                <p className="text-[10px] text-ferty-gray">
                                  Última Actualización: {formatDate(f0Form.submitted_at, 'long')}
                                </p>
                              )}
                            </div>
                          )}
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
                            className="text-ferty-coral hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() => {
                              const currentF0Form = submittedForms.find(f => f.form_type === 'F0');
                              handleF0Save(currentF0Form);
                            }}
                            className="text-ferty-rose hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
                            title="Guardar"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-6">
                      {/* Bloque superior para datos básicos: Nombre, Email y Fecha de nacimiento en una sola columna */}
                      <div className="space-y-4 mb-6">
                        <div className="border-b border-ferty-beige pb-3">
                          <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-1">Nombre</p>
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="w-full text-sm text-ferty-dark border-b border-ferty-rose focus:outline-none py-1 bg-transparent"
                          />
                        </div>
                        <div className="border-b border-ferty-beige pb-3">
                          <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-1">Email</p>
                          <p className="text-sm text-ferty-dark opacity-70">
                            {user.email} <span className="text-[10px] italic">(No editable)</span>
                          </p>
                        </div>
                        <div className="border-b border-ferty-beige pb-3">
                          <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-1">
                            Fecha de nacimiento
                          </p>
                          <input
                            type="date"
                            value={f0Answers['q1_birthdate'] || ''}
                            className="w-full border border-ferty-beige rounded-xl p-3 text-sm bg-ferty-beige/30 focus:border-ferty-rose outline-none transition-all"
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
                                  className="w-10 h-10 rounded-2xl border border-ferty-beigeBorder text-ferty-coral font-bold text-lg bg-white hover:bg-ferty-beige"
                                  type="button"
                                >
                                  -
                                </button>
                                <div className="flex-1 text-center bg-ferty-beigeLight border border-ferty-beige rounded-2xl py-2">
                                  <p className="text-lg font-bold text-ferty-dark">
                                    {numericValue !== undefined && !Number.isNaN(numericValue) ? numericValue : '—'}
                                  </p>
                                  {question.unit && (
                                    <p className="text-[11px] text-ferty-coral font-semibold">{question.unit}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleAdjust(1)}
                                  className="w-10 h-10 rounded-2xl border border-ferty-beigeBorder text-ferty-coral font-bold text-lg bg-white hover:bg-ferty-beige"
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
                                          ? 'bg-ferty-rose text-white border-ferty-rose'
                                          : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
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
                                        ? 'bg-ferty-rose text-white border-ferty-rose'
                                        : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
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
                              <label className="block text-xs font-bold text-ferty-dark mb-2 uppercase tracking-wide">
                                {q.text}
                              </label>
                              {q.type === 'textarea' ? (
                                <textarea
                                  value={f0Answers[q.id] || ''}
                                  className="w-full border border-ferty-beige rounded-xl p-3 text-sm h-28 bg-ferty-beige/30 focus:border-ferty-rose focus:ring-1 focus:ring-ferty-rose outline-none transition-all"
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
                                  className="w-full border border-ferty-beige rounded-xl p-3 text-sm bg-ferty-beige/30 focus:border-ferty-rose outline-none transition-all"
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
                                  className="w-full border border-ferty-beige rounded-xl p-3 text-sm bg-ferty-beige/30 focus:border-ferty-rose outline-none transition-all"
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
                        className="w-full bg-ferty-gray text-white py-4 rounded-xl font-bold shadow-lg mt-8 hover:bg-ferty-grayHover transition-all flex items-center justify-center gap-2"
                      >
                        Guardar cambios
                      </button>
                      </div>
                    </div>
                  ) : f0Form ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-ferty-beige overflow-hidden">
                      {/* Header clickeable del desplegable */}
                      <div className="p-6 flex items-center justify-between">
                        <button
                          onClick={() => setIsF0Expanded(!isF0Expanded)}
                          className="flex-1 text-left hover:opacity-80 transition-opacity"
                        >
                          <h3 className="font-bold text-lg text-ferty-dark mb-1">Ficha Personal</h3>
                          <p className="text-xs text-ferty-gray mb-1">
                            Actualiza estos sólo si es necesario
                          </p>
                          {(user?.joinedAt || f0Form?.submitted_at) && (
                            <div className="space-y-0.5">
                              {user?.joinedAt && (
                                <p className="text-[10px] text-ferty-gray">
                                  Fecha de Registro: {formatDate(user.joinedAt, 'long')}
                                </p>
                              )}
                              {f0Form?.submitted_at && (
                                <p className="text-[10px] text-ferty-gray">
                                  Última Actualización: {formatDate(f0Form.submitted_at, 'long')}
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

                              const initialAnswers: FormAnswersDict = {};
                              currentF0Form.answers.forEach((a: FormAnswer) => {
                                initialAnswers[a.questionId] = a.answer;
                              });

                              // cycle_length ya no está en F0, se maneja desde FUNCTION

                              originalF0Answers.current = JSON.parse(JSON.stringify(initialAnswers));
                              setF0Answers(initialAnswers);
                              setIsEditingF0(true);
                            }}
                            className="text-ferty-rose hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setIsF0Expanded(!isF0Expanded)}
                            className="text-ferty-rose hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
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
                        <div className="px-6 pb-6 border-t border-ferty-beige pt-6">
                          {/* Bloque superior para datos básicos: Nombre, Email y Fecha de nacimiento */}
                          <div className="space-y-4 mb-6">
                            <div className="border-b border-ferty-beige pb-3">
                              <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-1">Nombre</p>
                              <p className="text-sm text-ferty-dark">{user.name}</p>
                            </div>
                            <div className="border-b border-ferty-beige pb-3">
                              <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-1">Email</p>
                              <p className="text-sm text-ferty-dark opacity-70">
                                {user.email} <span className="text-[10px] italic">(No editable)</span>
                              </p>
                            </div>
                            <div className="border-b border-ferty-beige pb-3">
                              <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-1">
                                Fecha de nacimiento
                              </p>
                              <p className="text-sm text-ferty-dark">
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
                          <div className="space-y-4">
                            {(() => {
                              // Función helper para formatear valor
                              const formatValue = (q: any, value: any): string | null => {
                                if (value === null || value === undefined || value === '') return null;
                                if (q.type === 'date' && typeof value === 'string') {
                                  return formatDate(value, 'long');
                                } else if (Array.isArray(value)) {
                                  return value.join(', ');
                                } else if (typeof value === 'number' && (q as any).unit) {
                                  return `${value} ${(q as any).unit}`;
                                } else {
                                  return String(value);
                                }
                              };

                              // Función helper para renderizar un campo
                              const renderField = (label: string, value: string | null, colSpan: number = 1) => {
                                const isEmpty = !value || value.trim() === '';
                                return (
                                  <div key={label} className={colSpan === 2 ? 'col-span-2' : ''}>
                                    <p className="text-[10px] text-ferty-gray mb-0.5">{label}</p>
                                    <p className={`text-sm font-semibold ${isEmpty ? 'text-stone-400 italic' : 'text-ferty-dark'}`}>
                                      {isEmpty ? 'Sin respuesta' : value}
                                    </p>
                                  </div>
                                );
                              };

                              // Obtener respuestas
                              const getAnswer = (id: string) => {
                                const answer = f0Form.answers?.find(a => a.questionId === id);
                                return answer?.answer ?? null;
                              };

                              const getQuestion = (id: string) => {
                                return FORM_DEFINITIONS.F0.questions.find(q => q.id === id);
                              };

                              // Agrupar por secciones
                              const sections = [];

                              // DATOS FÍSICOS
                              const height = getAnswer('q2_height');
                              const weight = getAnswer('q2_weight');
                              if (height || weight) {
                                sections.push(
                                  <div key="datos-fisicos" className="border-b border-ferty-beige pb-3">
                                    <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                                      DATOS FÍSICOS
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                      {height && renderField(getQuestion('q2_height')?.text || 'Altura', formatValue(getQuestion('q2_height'), height))}
                                      {weight && renderField(getQuestion('q2_weight')?.text || 'Peso', formatValue(getQuestion('q2_weight'), weight))}
                                    </div>
                                  </div>
                                );
                              }

                              // OBJETIVO
                              const timeTrying = getAnswer('q3_time_trying');
                              const objective = getAnswer('q4_objective');
                              const partner = getAnswer('q5_partner');
                              const treatments = getAnswer('q20_fertility_treatments');
                              if (timeTrying || objective || partner || treatments) {
                                sections.push(
                                  <div key="objetivo" className="border-b border-ferty-beige pb-3">
                                    <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                                      OBJETIVO
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                      {timeTrying && renderField(getQuestion('q3_time_trying')?.text || 'Tiempo buscando embarazo', formatValue(getQuestion('q3_time_trying'), timeTrying))}
                                      {objective && renderField(getQuestion('q4_objective')?.text || 'Objetivo principal', formatValue(getQuestion('q4_objective'), objective))}
                                      {partner && renderField(getQuestion('q5_partner')?.text || '¿Buscas en pareja o solitario?', formatValue(getQuestion('q5_partner'), partner))}
                                      {treatments && renderField(getQuestion('q20_fertility_treatments')?.text || 'Tratamientos de fertilidad previos', formatValue(getQuestion('q20_fertility_treatments'), treatments))}
                                    </div>
                                  </div>
                                );
                              }

                              // HISTORIAL Y DIAGNÓSTICOS
                              const diagnoses = getAnswer('q9_diagnoses');
                              const familyHistory = getAnswer('q21_family_history');
                              if (diagnoses || familyHistory) {
                                sections.push(
                                  <div key="historial" className="border-b border-ferty-beige pb-3 last:border-0">
                                    <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-2">
                                      HISTORIAL Y DIAGNÓSTICOS
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                      {diagnoses && renderField(getQuestion('q9_diagnoses')?.text || 'Diagnósticos / Breve Historia Médica', formatValue(getQuestion('q9_diagnoses'), diagnoses), 2)}
                                      {familyHistory && renderField(getQuestion('q21_family_history')?.text || 'Antecedentes familiares relevantes', formatValue(getQuestion('q21_family_history'), familyHistory), 2)}
                                    </div>
                                  </div>
                                );
                              }

                              return sections.length > 0 ? sections : (
                                <div className="text-center py-4 text-stone-400">
                                  <p className="text-sm">No hay datos guardados</p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

            {/* Bloques de Pilares (Function, Food, Flora, Flow) */}
            <div>
              <h3 className="font-bold text-ferty-dark mb-3 text-sm">Pilares FertyFit</h3>
              <p className="text-xs text-ferty-gray mb-4">Completa los formularios de cada pilar para un análisis completo.</p>
              
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
                        isActive ? 'border-ferty-rose bg-white shadow-lg' : 'border-ferty-beige bg-white hover:bg-ferty-beigeLight'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-ferty-dark">{tab.label}</p>
                        {hasData && (
                          <CheckCircle size={14} className="text-emerald-600" />
                        )}
                      </div>
                      {pillarProgress > 0 && (
                        <ProgressBar 
                          percentage={pillarProgress}
                          color="rose-gradient"
                          height="sm"
                          className="bg-ferty-beige border-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="bg-ferty-beigeLight px-4 py-2.5 rounded-xl border border-ferty-beige mb-4">
                <ProgressBar 
                  percentage={progress.percentage}
                  color="rose-gradient"
                  height="md"
                  showLabel
                  label="Progreso"
                  showPercentage
                  containerClassName="mb-0"
                />
                {progress.percentage === 100 && (
                  <p className="text-[9px] text-ferty-gray mt-1.5 text-center">
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
                className="w-full py-2 text-xs text-stone-400 hover:text-ferty-rose transition-colors underline"
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
      </div>
    </div>
  );
};

// Memoize MyProfileView with custom comparison function
export default React.memo(MyProfileView, (prevProps, nextProps) => {
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

