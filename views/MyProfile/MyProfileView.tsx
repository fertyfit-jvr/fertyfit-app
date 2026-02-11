import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Award, Check, Edit2, FileText, LogOut, AlertCircle, X, Download, Loader2, ChevronDown, ChevronUp, CheckCircle, Smile, Meh, Frown, Angry, XCircle, Heart } from 'lucide-react';
import { ConsultationForm, DailyLog, UserProfile, ViewState, FormAnswer } from '../../types';

// Type for form answers dictionary (questionId -> answer value)
type FormAnswersDict = Record<string, string | number | boolean | string[] | Record<string, unknown> | undefined>;

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
import { FORM_DEFINITIONS } from '../../constants/formDefinitions';
import { generarDatosInformeMedico } from '../../services/MedicalReportHelpers';
import { calcularDiaDelCiclo } from '../../services/CycleCalculations';
import { updateConsultationFormById, updateProfileForUser } from '../../services/userDataService';
import { supabase } from '../../services/supabase';
import { formatDate } from '../../services/utils';
import { useMethodProgress } from '../../hooks/useMethodProgress';
import { calculateCurrentMonthsTrying, setTimeTryingStart } from '../../services/timeTryingService';
import { calculateAgeFromBirthdate } from '../../services/dateUtils';
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
    const typeMatches = form.form_type === type || LEGACY_FORM_MAP[form.form_type as keyof typeof LEGACY_FORM_MAP] === type;
    return typeMatches;
  });

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

  // FUNCTION: 'function_luteal_phase' solo visible si 'function_knows_fertile_days' === 'Sí'
  const isQuestionVisible = (questionId: string, formAnswers: any[]) => {
    if (questionId === 'function_luteal_phase') {
      const dependency = formAnswers.find((a: any) => a.questionId === 'function_knows_fertile_days');
      return dependency?.answer === 'Sí';
    }
    return true;
  };

  // Helper: valida si un valor cuenta como "respondido"
  const isAnswerValid = (value: any): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
    return true;
  };

  // Calculate progress: usa submittedForm si existe; si no hay submission = 0% (no contar defaults)
  const progress = useMemo(() => {
    if (!definition?.questions) return { answered: 0, total: 0, percentage: 0 };

    // Sin formulario enviado: progreso 0% (los defaults no cuentan como completado)
    if (!submittedForm?.answers || !Array.isArray(submittedForm.answers)) {
      return {
        answered: 0,
        total: definition.questions.length,
        percentage: 0
      };
    }

    const formAnswers = isEditMode
      ? definition.questions.map(q => ({ questionId: q.id, answer: answers[q.id] }))
      : submittedForm.answers;

    const visibleQuestions = definition.questions.filter(q => isQuestionVisible(q.id, formAnswers));
    const totalQuestions = visibleQuestions.length;
    const answeredQuestions = visibleQuestions.filter(question => {
      const answer = formAnswers.find((a: any) => a.questionId === question.id);
      const value = answer?.answer ?? answers[question.id];
      return isAnswerValid(value);
    }).length;

    return {
      answered: answeredQuestions,
      total: totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
    };
  }, [definition, submittedForm, answers, isEditMode]);

  // Calculate progress for each pillar based on submitted forms
  const getPillarProgress = (pillarId: PillarFormType): number => {
    const form = findSubmission(submittedForms, pillarId);
    if (!form || !form.answers || !Array.isArray(form.answers)) return 0;

    const pillarDef = FORM_DEFINITIONS[pillarId as keyof typeof FORM_DEFINITIONS];
    if (!pillarDef?.questions) return 0;

    const formAnswers = form.answers;
    const visibleQuestions = pillarDef.questions.filter(q => isQuestionVisible(q.id, formAnswers));
    const totalQuestions = visibleQuestions.length;
    const answeredQuestions = visibleQuestions.filter(question => {
      const answer = form.answers.find((a: any) => a.questionId === question.id);
      if (!answer) return false;
      const value = answer.answer;

      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;

      // Objeto vacío (flow_ejer sin tipos) no cuenta como respondido
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
          // Handle Flora fields with combined "main: detail" format
          if (typeof answer.answer === 'string' && answer.answer.includes(': ')) {
            const [mainValue, detailValue] = answer.answer.split(': ', 2);
            if (answer.questionId === 'flora_pruebas' || answer.questionId === 'flora_suplementos') {
              loaded[answer.questionId] = mainValue;
              if (detailValue) loaded[`${answer.questionId}_otro`] = detailValue;
            } else if (answer.questionId === 'flora_intol') {
              loaded[answer.questionId] = mainValue;
              if (detailValue) loaded[`${answer.questionId}_detalle`] = detailValue;
            } else if (answer.questionId === 'flora_piel' || answer.questionId === 'flora_cabello') {
              loaded[answer.questionId] = mainValue;
              if (detailValue) loaded[`${answer.questionId}_otro`] = detailValue;
            } else {
              loaded[answer.questionId] = answer.answer;
            }
          } else if (answer.questionId === 'flora_sintomas' && typeof answer.answer === 'string') {
            loaded[answer.questionId] = answer.answer === 'Ninguno' ? [] : answer.answer.split(', ').map(s => s.trim());
          } else if (answer.questionId === 'flow_ejer') {
            try {
              loaded[answer.questionId] = typeof answer.answer === 'string' && answer.answer !== 'Ninguno'
                ? JSON.parse(answer.answer)
                : {};
            } catch {
              loaded[answer.questionId] = {};
            }
          } else if (answer.questionId === 'flow_entorno_social') {
            const str = typeof answer.answer === 'string' ? answer.answer : '';
            if (str.includes('::')) {
              const [main, otro] = str.split('::', 2);
              loaded[answer.questionId] = main || '';
              if (otro) loaded[`${answer.questionId}_otro`] = otro;
            } else {
              loaded[answer.questionId] = str || '';
            }
          } else if (answer.questionId === 'flow_drogas') {
            const str = typeof answer.answer === 'string' ? answer.answer : '';
            if (str.startsWith('Sí:')) {
              loaded[answer.questionId] = 'Sí';
              const detalle = str.substring(4).trim();
              if (detalle) loaded[`${answer.questionId}_detalle`] = detalle;
            } else {
              loaded[answer.questionId] = str || 'No';
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

    const formattedAnswers = definition.questions
      .filter(question => {
        // FUNCTION: no incluir function_luteal_phase si knows_fertile_days !== 'Sí'
        if (question.id === 'function_luteal_phase') {
          return answers['function_knows_fertile_days'] === 'Sí';
        }
        return true;
      })
      .map(question => {
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
        // flora_intol: combine with detalle when a, b, or c selected
        if (question.id === 'flora_intol' && (String(baseAnswer).startsWith('a)') || String(baseAnswer).startsWith('b)') || String(baseAnswer).startsWith('c)'))) {
          const detalle = answers[`${question.id}_detalle`] || '';
          return {
            questionId: question.id,
            question: question.text,
            answer: detalle ? `${baseAnswer}: ${detalle}` : baseAnswer
          };
        }
        // flora_piel, flora_cabello: combine with otro when applicable
        if ((question.id === 'flora_piel' && baseAnswer === 'Sí - otra (especificar)') || (question.id === 'flora_cabello' && baseAnswer === 'Otra (especificar)')) {
          const otroValue = answers[`${question.id}_otro`] || '';
          return {
            questionId: question.id,
            question: question.text,
            answer: otroValue ? `${baseAnswer}: ${otroValue}` : baseAnswer
          };
        }
        // flora_sintomas: array, store as comma-separated or JSON
        if (question.id === 'flora_sintomas') {
          const val = Array.isArray(baseAnswer) ? baseAnswer : (baseAnswer ? [baseAnswer] : []);
          return {
            questionId: question.id,
            question: question.text,
            answer: val.length > 0 ? val.join(', ') : 'Ninguno'
          };
        }
        // flow_ejer: object → JSON string
        if (question.id === 'flow_ejer') {
          const obj = typeof baseAnswer === 'object' && baseAnswer !== null ? baseAnswer : {};
          return {
            questionId: question.id,
            question: question.text,
            answer: Object.keys(obj).length > 0 ? JSON.stringify(obj) : 'Ninguno'
          };
        }
        // flow_entorno_social: string + otro (usamos :: para "Otra (especificar)" detalle)
        if (question.id === 'flow_entorno_social') {
          const str = typeof baseAnswer === 'string' ? baseAnswer : '';
          const otro = answers[`${question.id}_otro`] || '';
          return {
            questionId: question.id,
            question: question.text,
            answer: otro ? `${str}::${otro}` : str
          };
        }
        // flow_drogas: Sí/No + detalle (si Sí)
        if (question.id === 'flow_drogas') {
          const str = typeof baseAnswer === 'string' ? baseAnswer : '';
          const detalle = answers[`${question.id}_detalle`] || '';
          return {
            questionId: question.id,
            question: question.text,
            answer: (str === 'Sí' && detalle) ? `Sí: ${detalle}` : str
          };
        }
        return {
          questionId: question.id,
          question: question.text,
          answer: baseAnswer
        };
      });

    // Cuando function_luteal_phase está oculta, no incluirla en answers para el guardado
    const answersForSave = formType === 'FUNCTION' && answers['function_knows_fertile_days'] !== 'Sí'
      ? { ...answers, function_luteal_phase: undefined }
      : answers;

    // Use dual saving: pillar table (current state) + consultation_forms (history)
    const result = await savePillarForm(user.id, formType, answersForSave, logs, formattedAnswers);

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

  const updateAnswer = useCallback((id: string, value: string | number | boolean | string[] | Record<string, any> | undefined) => {
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

  const renderCheckboxesControl = (question: any) => {
    const options = question.options || [];
    const currentValue = answers[question.id];
    const selected = Array.isArray(currentValue) ? currentValue : [];

    const toggleOption = (option: string) => {
      const newSelected = selected.includes(option)
        ? selected.filter((o: string) => o !== option)
        : [...selected, option];
      updateAnswer(question.id, newSelected);
    };

    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option: string) => {
          const isActive = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleOption(option)}
              className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all ${isActive
                ? 'bg-ferty-flora-accent/20 text-ferty-flora-accent border-ferty-flora-accent'
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

    // Iconos minimalistas con colores de marca FertyFit (rose/coral)
    const FaceIcons = [Smile, Meh, Frown, Angry, XCircle];
    const labels = ['Nada', 'Leve', 'Moderado', 'Fuerte', 'Insoportable'];

    return (
      <div className="space-y-3">
        <div className="flex justify-between px-2">
          {values.map((value, index) => {
            const IconComponent = FaceIcons[index] || Smile;
            const isActive = answers[question.id] === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => updateAnswer(question.id, value)}
                className={`flex flex-col items-center gap-1.5 transition-all duration-200 p-2 rounded-xl ${isActive
                  ? 'bg-ferty-rose/20 text-ferty-coral scale-110'
                  : 'text-ferty-beigeMuted hover:text-ferty-gray hover:bg-ferty-beige/50 opacity-70 hover:opacity-100'
                  }`}
              >
                <IconComponent
                  size={28}
                  strokeWidth={1.5}
                  className={isActive ? 'text-ferty-coral' : 'text-ferty-beigeMuted'}
                />
                <span className={`text-[9px] font-bold uppercase ${isActive ? 'text-ferty-coral' : 'text-ferty-beigeMuted'}`}>
                  {labels[index]}
                </span>
                {isActive && <div className="w-1.5 h-1.5 bg-ferty-rose rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderExerciseTypeControl = (question: any) => {
    const options = question.options || ['Cardiovascular', 'Fuerza'];
    const data = (answers[question.id] as Record<string, { cantidad: number; intensidad: string }>) || {};
    const intensidades = ['Baja', 'Media', 'Alta'];

    const toggleType = (type: string) => {
      const key = type.toLowerCase();
      const next = { ...data };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { cantidad: 0, intensidad: 'Media' };
      }
      updateAnswer(question.id, next);
    };

    const setCantidad = (type: string, delta: number) => {
      const key = type.toLowerCase();
      const current = data[key] || { cantidad: 0, intensidad: 'Media' };
      const nueva = Math.max(0, Math.min(7, current.cantidad + delta));
      updateAnswer(question.id, { ...data, [key]: { ...current, cantidad: nueva } });
    };

    const setIntensidad = (type: string, intensidad: string) => {
      const key = type.toLowerCase();
      const current = data[key] || { cantidad: 0, intensidad: 'Media' };
      updateAnswer(question.id, { ...data, [key]: { ...current, intensidad } });
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {options.map((opt: string) => {
            const key = opt.toLowerCase();
            const isActive = !!data[key];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleType(opt)}
                className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all ${isActive ? 'bg-ferty-flow-accent/20 text-ferty-flow-accent border-ferty-flow-accent' : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
                  }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {options.map((opt: string) => {
          const key = opt.toLowerCase();
          if (!data[key]) return null;
          const val = data[key];
          return (
            <div key={opt} className="bg-ferty-beige/30 rounded-xl p-3 space-y-3 border border-ferty-beige">
              <p className="text-xs font-bold text-ferty-dark">{opt}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ferty-coral font-semibold shrink-0">Cantidad:</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCantidad(opt, -1)} className="w-8 h-8 rounded-lg border border-ferty-beigeBorder text-ferty-coral font-bold bg-white hover:bg-ferty-beige" type="button">−</button>
                  <span className="min-w-[2rem] text-center font-bold text-ferty-dark">{val.cantidad}</span>
                  <button onClick={() => setCantidad(opt, 1)} className="w-8 h-8 rounded-lg border border-ferty-beigeBorder text-ferty-coral font-bold bg-white hover:bg-ferty-beige" type="button">+</button>
                </div>
                <span className="text-[11px] text-ferty-beigeMuted">veces/semana</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ferty-coral font-semibold shrink-0">Intensidad:</span>
                <div className="flex gap-1">
                  {intensidades.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIntensidad(opt, i)}
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${val.intensidad === i ? 'bg-ferty-flow-accent text-white border-ferty-flow-accent' : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
                        }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderControl = (question: FormQuestion) => {
    const controlType = question.control ?? question.type;

    // Flow-specific variations - simplified controls
    if (formType === 'FLOW') {
      // Ejercicio: Cardiovascular/Fuerza con Cantidad e Intensidad
      if (question.id === 'flow_ejer') {
        return renderExerciseTypeControl(question);
      }

      // Entorno social: solo una opción, color marrón, "Otra (especificar)" → campo texto
      if (question.id === 'flow_entorno_social') {
        const selected = answers[question.id] as string;
        const showOtherField = selected === 'Otra (especificar)';
        const opts = question.options || [];
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {opts.map((opt: string) => {
                const isActive = selected === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateAnswer(question.id, opt)}
                    className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all ${isActive ? 'bg-ferty-coral text-white border-ferty-coral' : 'text-ferty-gray border-ferty-beigeBorder hover:bg-ferty-beige'
                      }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {showOtherField && (
              <input
                type="text"
                value={(answers[`${question.id}_otro`] as string) || ''}
                placeholder="Especifica..."
                onChange={event => updateAnswer(`${question.id}_otro`, event.target.value)}
                className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose"
              />
            )}
          </div>
        );
      }

      // Consumo de drogas: Sí/No + campo de texto condicional
      if (question.id === 'flow_drogas') {
        const selected = answers[question.id] as string;
        const showDetailField = selected === 'Sí';
        return (
          <div className="space-y-3">
            {renderButtons(question, ['Sí', 'No'])}
            {showDetailField && (
              <textarea
                value={(answers[`${question.id}_detalle`] as string) || ''}
                placeholder="Indica qué drogas y con qué frecuencia..."
                onChange={event => updateAnswer(`${question.id}_detalle`, event.target.value)}
                className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose focus:ring-1 focus:ring-ferty-rose"
                rows={3}
              />
            )}
          </div>
        );
      }

    }

    // Flora - conditional text fields
    if (formType === 'FLORA') {
      const selectedValue = answers[question.id];

      // flora_pruebas, flora_suplementos: "Otra" → campo texto
      if (question.id === 'flora_pruebas' || question.id === 'flora_suplementos') {
        const showOtherField = selectedValue === 'Otra' || selectedValue === 'Otro';
        return (
          <div className="space-y-3">
            {renderButtons(question, question.options || [])}
            {showOtherField && (
              <input
                type="text"
                value={answers[`${question.id}_otro`] ? String(answers[`${question.id}_otro`]) : ''}
                placeholder="Especifica..."
                onChange={event => updateAnswer(`${question.id}_otro`, event.target.value)}
                className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose"
              />
            )}
          </div>
        );
      }

      // flora_intol: opciones a, b, c (Sí) → campo texto para indicar cuál/cuáles
      if (question.id === 'flora_intol') {
        const strValue = typeof selectedValue === 'string' ? selectedValue : '';
        const showDetailField = strValue.startsWith('a)') || strValue.startsWith('b)') || strValue.startsWith('c)');
        return (
          <div className="space-y-3">
            {renderButtons(question, question.options || [])}
            {showDetailField && (
              <input
                type="text"
                value={answers[`${question.id}_detalle`] ? String(answers[`${question.id}_detalle`]) : ''}
                placeholder="Indica cuál o cuáles..."
                onChange={event => updateAnswer(`${question.id}_detalle`, event.target.value)}
                className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose"
              />
            )}
          </div>
        );
      }

      // flora_piel: "Sí - otra" → campo texto
      if (question.id === 'flora_piel') {
        const showOtherField = selectedValue === 'Sí - otra (especificar)';
        return (
          <div className="space-y-3">
            {renderButtons(question, question.options || [])}
            {showOtherField && (
              <input
                type="text"
                value={answers[`${question.id}_otro`] ? String(answers[`${question.id}_otro`]) : ''}
                placeholder="Especifica..."
                onChange={event => updateAnswer(`${question.id}_otro`, event.target.value)}
                className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose"
              />
            )}
          </div>
        );
      }

      // flora_cabello: "Otra" → campo texto
      if (question.id === 'flora_cabello') {
        const showOtherField = selectedValue === 'Otra (especificar)';
        return (
          <div className="space-y-3">
            {renderButtons(question, question.options || [])}
            {showOtherField && (
              <input
                type="text"
                value={answers[`${question.id}_otro`] ? String(answers[`${question.id}_otro`]) : ''}
                placeholder="Especifica..."
                onChange={event => updateAnswer(`${question.id}_otro`, event.target.value)}
                className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose"
              />
            )}
          </div>
        );
      }
    }

    if (question.type === 'textarea') {
      return (
        <textarea
          value={answers[question.id] ? String(answers[question.id]) : ''}
          className="w-full border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose focus:ring-1 focus:ring-ferty-rose"
          rows={4}
          onChange={event => updateAnswer(question.id, event.target.value)}
        />
      );
    }

    if (question.type === 'checkboxes') {
      return renderCheckboxesControl(question);
    }

    if (question.type === 'flow_faces') {
      return renderFlowFacesControl(question);
    }

    if (question.type === 'faces') {
      return renderFacesControl(question);
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
          value={answers[question.id] ? String(answers[question.id]) : ''}
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
          value={answers[question.id] ? String(answers[question.id]) : ''}
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
        value={answers[question.id] ? String(answers[question.id]) : ''}
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
          // FUNCTION: 'function_luteal_phase' solo si 'function_knows_fertile_days' === 'Sí'
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

            // Para FUNCTION y otros pilares: mostrar en una sección general

            // Filtrar por visibilidad (ej: function_luteal_phase solo si knows_fertile_days === 'Sí')
            const visibleFilteredAnswers = filteredAnswers.filter((answer: any) =>
              isQuestionVisible(answer.questionId, submittedForm.answers)
            );

            const FaceIconsView = [Smile, Meh, Frown, Angry, XCircle];
            const faceLabels = ['Nada', 'Leve', 'Moderado', 'Fuerte', 'Insoportable'];

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

                    // Si es tipo 'faces', mostrar icono + etiqueta en lugar del número
                    if (question?.type === 'faces' && typeof value === 'number') {
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

                    // flow_stress / flow_emocion / flora_dig: número 1-7 con icono (sin mostrar número)
                    if ((answer.questionId === 'flow_stress' || answer.questionId === 'flow_emocion' || answer.questionId === 'flora_dig') && typeof value === 'number') {
                      const stressIcons = [Smile, Meh, Meh, Frown, Frown, Angry, XCircle];
                      const emotionIcons = [Frown, Meh, Meh, Meh, Smile, Smile, Heart];
                      const digestiveIcons = [XCircle, Frown, Frown, Meh, Meh, Smile, Smile];
                      const icons =
                        answer.questionId === 'flow_emocion' ? emotionIcons
                          : answer.questionId === 'flora_dig' ? digestiveIcons
                            : stressIcons;
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

                    // flow_entorno_social: "opción::otro" → texto legible
                    if (answer.questionId === 'flow_entorno_social' && typeof value === 'string') {
                      const display = value.includes('::') ? value.replace('::', ' — ') : value;
                      return renderField(label, display || '—');
                    }

                    // flow_sueno: mostrar con unidad (horas)
                    if (answer.questionId === 'flow_sueno' && (typeof value === 'number' || typeof value === 'string')) {
                      const num = typeof value === 'string' ? parseFloat(value) : value;
                      return renderField(label, Number.isFinite(num) ? `${num} horas` : value);
                    }

                    // Steppers con unidad
                    if ((answer.questionId === 'flow_relax' || answer.questionId === 'food_azucar' || answer.questionId === 'food_pescado' || answer.questionId === 'flora_ferm') && (typeof value === 'number' || typeof value === 'string')) {
                      return renderField(label, `${value} veces/semana`);
                    }
                    if (answer.questionId === 'food_vege' && (typeof value === 'number' || typeof value === 'string')) {
                      return renderField(label, `${value} raciones`);
                    }

                    // function_cycle_length, function_luteal_phase: con unidad días
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
                              value={f0Answers['q1_birthdate'] ? String(f0Answers['q1_birthdate']) : ''}
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
                                        className={`px-3 py-2 text-xs font-bold rounded-full border transition-all ${isActive
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
                                      className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all ${isActive
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
                                    value={f0Answers[q.id] ? String(f0Answers[q.id]) : ''}
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
                                    value={f0Answers[q.id] ? String(f0Answers[q.id]) : ''}
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
                                    value={f0Answers[q.id] ? String(f0Answers[q.id]) : ''}
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

                              // Función helper para renderizar un campo (una columna)
                              const renderField = (label: string, value: string | null) => {
                                const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
                                return (
                                  <div key={label} className="border-b border-ferty-beige/50 pb-3 last:border-0 last:pb-0">
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
                                    <div className="flex flex-col gap-3">
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
                                    <div className="flex flex-col gap-3">
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
                                    <div className="flex flex-col gap-3">
                                      {diagnoses && renderField(getQuestion('q9_diagnoses')?.text || 'Diagnósticos / Breve Historia Médica', formatValue(getQuestion('q9_diagnoses'), diagnoses))}
                                      {familyHistory && renderField(getQuestion('q21_family_history')?.text || 'Antecedentes familiares relevantes', formatValue(getQuestion('q21_family_history'), familyHistory))}
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
                    const pillarProgress = getPillarProgress(tab.id);
                    const isActive = formType === tab.id;
                    // Pestaña activa: usar progress.percentage (incluye answers actuales); demás: pillarProgress
                    const tabProgress = isActive ? progress.percentage : pillarProgress;
                    const showCheck = tabProgress >= 100;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFormType(tab.id)}
                        className={`rounded-3xl border px-4 py-4 text-left transition-all shadow-sm ${isActive ? 'border-ferty-rose bg-white shadow-lg' : 'border-ferty-beige bg-white hover:bg-ferty-beigeLight'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-ferty-dark">{tab.label}</p>
                          {showCheck && (
                            <CheckCircle size={14} className="text-emerald-600" />
                          )}
                        </div>
                        {tabProgress > 0 && (
                          <ProgressBar
                            percentage={tabProgress}
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

