import { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, AlertCircle, Camera, Check, CheckCircle, ChevronDown, Clock, Download, Edit2, X } from 'lucide-react';
import { ConsultationForm, DailyLog, UserProfile } from '../../types';
import { FORM_DEFINITIONS } from '../../constants/formDefinitions';
import { calculateAverages } from '../../services/dataService';
import { ExamScanner } from '../../components/forms/ExamScanner';
import { formatDate } from '../../services/utils';
import { PILLAR_ICONS } from '../../constants/api';
import { savePillarForm } from '../../services/pillarService';

interface ConsultationsViewProps {
  user: UserProfile;
  logs: DailyLog[];
  submittedForms: ConsultationForm[];
  showNotif: (msg: string, type: 'success' | 'error') => void;
  fetchUserForms: (userId: string) => Promise<void>;
}

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

const ConsultationsView = ({ user, logs, submittedForms, showNotif, fetchUserForms }: ConsultationsViewProps) => {
  const [formType, setFormType] = useState<PillarFormType>('FUNCTION');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [scanningSection, setScanningSection] = useState<string | null>(null);
  const [isScanningAll, setIsScanningAll] = useState(false); // Nuevo estado para escaneo universal
  const originalAnswers = useRef<Record<string, any>>({});
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mapeo de secciones a tipos de examen
  const SECTION_TO_EXAM_TYPE: Record<string, 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio'> = {
    function_panel_hormonal: 'hormonal',
    function_panel_metabolico: 'metabolic',
    function_vitamina_d: 'vitamin_d',
    function_ecografia: 'ecografia',
    function_hsg: 'hsg',
    function_espermio: 'espermio',
  };


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
  // Only counts answers that differ from default values (user actually filled them)
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
    
    return totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  };

  useEffect(() => {
    if (!definition?.sections) {
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

  // Guardado automático después de 5 minutos de inactividad
  // El timer se resetea automáticamente cada vez que el usuario escribe (debounce)
  useEffect(() => {
    if (!isEditMode || !definition) return;

    // Limpiar timeout anterior (esto crea el efecto debounce)
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Guardar automáticamente después de 5 minutos de inactividad
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSubmit();
    }, 300000); // 5 minutos = 300000ms

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [answers, isEditMode, definition]);

  // Advertencia al cambiar de vista sin guardar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditMode) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditMode]);

  const handleCancelEdit = () => {
    setAnswers(JSON.parse(JSON.stringify(originalAnswers.current))); // Restaurar valores originales
    setIsEditMode(false);
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || !definition) return;

    // Limpiar timeout de guardado automático
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
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
    // Actualizar respuestas con los datos extraídos
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

  const renderFunctionForm = () => (
    <div className="space-y-4">
      {definition.sections?.map(section => {
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
                {/* Botón de escaneo si la sección tiene mapeo */}
                {SECTION_TO_EXAM_TYPE[section.id] && (
                  <button
                    type="button"
                    onClick={() => setScanningSection(section.id)}
                    className="w-full flex items-center justify-center gap-2 bg-[#F4F0ED] hover:bg-[#E1D7D3] border border-[#E1D7D3] rounded-xl py-3 transition-colors"
                  >
                    <Camera size={18} className="text-[#95706B]" />
                    <span className="text-sm font-bold text-[#95706B]">Escanear examen</span>
                  </button>
                )}
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
        {/* Header with Icon, Name, Date, and Edit buttons */}
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
          {/* Solo mostrar botones de editar si ya existe un submittedForm */}
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
                    onClick={handleSubmit}
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
      {/* Botón único de escaneo para FUNCTION - discreto y elegante */}
      {formType === 'FUNCTION' && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-gradient-to-r from-[#F9F6F4] to-[#F4F0ED] border border-[#E1D7D3] rounded-2xl">
          <div className="flex-1">
            <p className="text-xs font-bold text-[#95706B] mb-0.5">Escaneo inteligente</p>
            <p className="text-[10px] text-[#5D7180]">Sube una foto y detectaremos automáticamente todos los valores</p>
          </div>
          <button
            type="button"
            onClick={() => setIsScanningAll(true)}
            className="flex items-center gap-2 bg-white hover:bg-[#F9F6F4] border border-[#C7958E] text-[#95706B] px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all"
          >
            <Camera size={16} />
            Escanear
          </button>
        </div>
      )}
      
      {formType === 'FUNCTION' ? renderFunctionForm() : renderGeneralForm()}
        <button onClick={handleSubmit} className="w-full bg-[#5D7180] text-white py-4 rounded-xl font-bold shadow-lg mt-8 hover:bg-[#4A5568] transition-all flex items-center justify-center gap-2">
        Guardar y enviar <Download size={16} />
      </button>
    </div>
  );
  };

  const renderSubmittedView = () => {
    // formatDate is now imported from services/utils
    const currentTab = PILLAR_TABS.find(tab => tab.id === formType);
    
    // For FUNCTION form, group answers by sections
    const renderFunctionSubmittedView = () => {
      if (!definition?.sections || !submittedForm?.answers) return null;
      
      return (
        <div className="space-y-4">
          {definition.sections.map(section => {
            // Get answers for this section
            const sectionAnswers = submittedForm.answers.filter((answer: any) => 
              section.fields.some(field => field.id === answer.questionId)
            );
            
            // Only show section if it has answers
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
                            {field?.unit && answer.answer && (
                              <span className="text-[10px] text-[#95706B]/80 ml-1">{field.unit}</span>
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
        {/* Header with Icon, Name, Date, and Edit buttons */}
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
                handleSubmit();
              } else {
                originalAnswers.current = JSON.parse(JSON.stringify(answers)); // Guardar valores originales antes de editar
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
        
        {/* Render grouped by sections for FUNCTION, grid for others */}
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
    <div className="pb-24 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#4A4A4A]">Consultas</h2>
        <p className="text-sm text-[#5D7180]">Puedes actualizarlos durante todo el método.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {/* Progress Bar - Always visible, more discrete */}
        <div className="bg-[#F9F6F4] px-4 py-2.5 rounded-xl border border-[#F4F0ED]">
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
        
        {submittedForm && !isEditMode
          ? renderSubmittedView()
          : renderFormCard()}
      </div>

      {/* Exam Scanner Modal - Modo específico por sección */}
      {scanningSection && SECTION_TO_EXAM_TYPE[scanningSection] && (
        <ExamScanner
          examType={SECTION_TO_EXAM_TYPE[scanningSection]}
          onDataExtracted={handleDataExtracted}
          onClose={() => setScanningSection(null)}
          sectionTitle={definition.sections?.find(s => s.id === scanningSection)?.title}
        />
      )}

      {/* Exam Scanner Modal - Modo detección automática universal */}
      {isScanningAll && (
        <ExamScanner
          autoDetect={true}
          onDataExtracted={handleDataExtracted}
          onClose={() => setIsScanningAll(false)}
        />
      )}
    </div>
  );
};

export default ConsultationsView;
