import React, { Component, useState, useEffect, ErrorInfo, ReactNode } from 'react';
import {
  Heart, Activity, BookOpen, FileText, User, LogOut, AlertCircle,
  Moon, Sun, PlayCircle, FileText as PdfIcon,
  Lock, X, Star, Award, Mail, Key, CheckSquare, Download, ChevronDown, ChevronUp, ArrowRight, Smile, Play,
  CheckCircle, WineOff, Calendar, Thermometer, Droplets, Zap, Clock, Scale, Leaf, Minus, Plus, Sparkles, Trash, Check, Edit2
} from 'lucide-react';

import { UserProfile, DailyLog, ViewState, CourseModule, MucusType, DailyLog as DailyLogType, ConsultationForm, LHResult, Lesson, AppNotification } from './types';
import { SYMPTOM_OPTIONS, MUCUS_OPTIONS, CERVIX_HEIGHT_OPTIONS, CERVIX_FIRM_OPTIONS, CERVIX_OPEN_OPTIONS, BRAND_ASSETS, LH_OPTIONS } from './constants';
import { calculateAverages, calculateAlcoholFreeStreak, getLastLogDetails, formatDateForDB, calculateBMI, calculateVitalityStats, getBMIStatus } from './services/dataService';
import { supabase } from './services/supabase';

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



const getAlertsAndOpportunities = (user: UserProfile, logs: DailyLog[], scores: any) => {
  const items = [];
  const recentLogs = logs.slice(0, 14);

  // ALERTS (Red)
  // Alcohol
  const alcoholDays = recentLogs.filter(l => l.alcohol).length;
  if (alcoholDays > 2) {
    items.push({
      type: 'alert',
      title: 'Hábito Nocivo Detectado',
      desc: 'Has registrado consumo de alcohol frecuente. Esto reduce tu FertyScore.',
      action: 'Ver Módulo 3',
      link: 'EDUCATION'
    });
  }

  // Low Sleep
  const avgSleep = parseFloat(calculateAverages(recentLogs).sleep);
  if (avgSleep < 6 && avgSleep > 0) {
    items.push({
      type: 'alert',
      title: 'Déficit de Sueño',
      desc: 'Tu promedio de sueño es bajo (<6h). Prioriza el descanso.',
      action: 'Tips de Sueño',
      link: 'EDUCATION'
    });
  }

  // OPPORTUNITIES (Green)
  // Report Due
  if (user.methodStartDate) {
    const start = new Date(user.methodStartDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    const nextReportDay = days <= 28 ? 28 : (days <= 56 ? 56 : 84);
    const daysLeft = nextReportDay - days;

    if (daysLeft <= 14 && daysLeft > 0) {
      items.push({
        type: 'opportunity',
        title: `Próximo Informe F${days <= 28 ? '1' : (days <= 56 ? '2' : '3')} en...`,
        desc: `¡Te quedan ${daysLeft} días! Revisa tus objetivos.`,
        action: `Ver Módulo ${days <= 28 ? '4' : (days <= 56 ? '8' : '12')}`,
        link: 'EDUCATION'
      });
    }
  }

  // Positive Reinforcement (Good Sleep)
  const avgSleepGood = parseFloat(calculateAverages(recentLogs).sleep);
  if (avgSleepGood >= 7.5) {
    items.push({
      type: 'opportunity',
      title: '¡Gran Descanso!',
      desc: 'Tu sueño es óptimo. Esto es clave para tu equilibrio hormonal.',
      action: '',
      link: ''
    });
  }

  return items;
};

const FORM_DEFINITIONS = {
  F0: {
    title: "F0: Ficha Personal Inicial",
    description: "Esta información es la base de tu protocolo personalizado.",
    questions: [
      // EASY INTERACTIONS FIRST (sliders, steppers, buttons)
      { id: 'q1_birthdate', text: "Tu fecha de nacimiento:", type: 'date' },
      { id: 'q2_height', text: "Altura:", type: 'slider', min: 140, max: 200, unit: 'cm' },
      { id: 'q2_weight', text: "Peso:", type: 'slider', min: 40, max: 150, unit: 'kg' },
      { id: 'q3_time_trying', text: "Tiempo buscando embarazo:", type: 'stepper', min: 0, max: 60, unit: 'meses' },
      { id: 'q4_objective', text: "Objetivo principal:", type: 'buttons', options: ['Concepción natural', 'Reproducción Asistida'] },
      { id: 'q5_partner', text: "¿Buscas en pareja o solitario?", type: 'buttons', options: ['Pareja', 'Solitario'] },
      { id: 'q6_cycle', text: "Duración ciclo promedio:", type: 'stepper', min: 21, max: 40, unit: 'días' },
      { id: 'q7_regularity', text: "¿Ciclos regulares?", type: 'buttons', options: ['Regulares', 'Irregulares'] },
      { id: 'q8_last_period', text: "Fecha última regla:", type: 'date' },
      { id: 'q15_stress', text: "Nivel de Estrés:", type: 'segmented', min: 1, max: 5 },
      { id: 'q16_sleep', text: "Horas de sueño promedio:", type: 'slider', min: 0, max: 12, step: 0.5, unit: 'h' },
      { id: 'q17_smoker', text: "¿Fumas?", type: 'buttons', options: ['No', 'Sí, ocasional', 'Sí, diario'] },
      { id: 'q18_alcohol', text: "¿Consumo de alcohol?", type: 'buttons', options: ['No', 'Ocasional', 'Frecuente'] },
      { id: 'q19_supplements', text: "¿Tomas suplementos actualmente?", type: 'yesno' },
      { id: 'q20_fertility_treatments', text: "Tratamientos de fertilidad previos:", type: 'buttons', options: ['Ninguno', 'FIV', 'Inseminación', 'Ovodonación'] },

      // TEXT FIELDS LAST (require keyboard)
      { id: 'q9_diagnoses', text: "Diagnósticos / Breve Historia Médica:", type: 'textarea', optional: true },
      { id: 'q21_family_history', text: "Antecedentes familiares relevantes:", type: 'textarea', optional: true }
    ]
  },
  F1: {
    title: "F1: Punto de Partida (Semana 4)",
    questions: [
      { id: 'q1_confirm_tracker', text: "Confirma que has completado el registro de biomarcadores (30 días).", type: 'yesno' },
      { id: 'q2_cycle_length', text: "¿Cuál es la duración promedio de tu ciclo (en días)?", type: 'number' },
      { id: 'q3_immediate_changes', text: "¿Has implementado los 3 cambios inmediatos (sueño, caminar, sin azúcar)?", type: 'yesno' },
      { id: 'q4_supplements', text: "Suplementos iniciados y dosis:", type: 'text', optional: true },
      { id: 'q5_detox', text: "¿Has realizado la Auditoría de hogar (Detox)?", type: 'yesno' },
      { id: 'q6_symptoms', text: "Describe síntomas nuevos o cambios importantes:", type: 'textarea', optional: true },
      { id: 'q7_doubt', text: "¿Cuál es tu mayor duda ahora mismo?", type: 'textarea' }
    ]
  },
  F2: {
    title: "F2: Resultados Clínicos (Semana 8)",
    questions: [
      { id: 'q1_amh', text: "Valor AMH y fecha:", type: 'text' },
      { id: 'q2_tsh', text: "Valor TSH y T4 libre:", type: 'text' },
      { id: 'q3_fsh_e2', text: "Valores FSH y Estradiol (Día 3-5):", type: 'text' },
      { id: 'q4_prog', text: "Valor Progesterona (Fase Lútea):", type: 'text' },
      { id: 'q5_vitd', text: "Valor Vitamina D:", type: 'text' },
      { id: 'q6_afc', text: "Recuento Folículos Antrales:", type: 'text' },
      { id: 'q7_male', text: "Resumen Seminograma Pareja:", type: 'textarea', optional: true },
      { id: 'q8_microbiota', text: "Resumen Test Microbiota (si aplica):", type: 'textarea', optional: true },
      { id: 'q9_nutrition', text: "% Adherencia Nutricional estimada (0-100):", type: 'number' },
      { id: 'q10_supp_adj', text: "¿Ajustaste suplementación tras analíticas?", type: 'yesno' },
      { id: 'q11_emotional', text: "Práctica emocional y frecuencia:", type: 'text' },
      { id: 'q12_changes', text: "¿Cambios en bienestar tras protocolos?", type: 'textarea', optional: true },
      { id: 'q13_doubt', text: "Duda principal tras resultados:", type: 'textarea' }
    ]
  },
  F3: {
    title: "F3: Hoja de Ruta Final (Semana 12)",
    questions: [
      { id: 'q1_value', text: "¿Qué ha sido lo más valioso del método?", type: 'textarea' },
      { id: 'q2_improvements', text: "Mejoras en Estrés/Sueño/Ciclo vs Semana 1:", type: 'textarea' },
      { id: 'q3_final_labs', text: "¿Mejoraron valores VitD/Ferritina/TSH?", type: 'text' },
      { id: 'q4_masterplan', text: "Confirma completado 'Plan Maestro':", type: 'yesno' },
      { id: 'q5_route', text: "Ruta Estratégica Decidida:", type: 'select', options: ['Concepción Natural', 'Reproducción Asistida', 'Pausa'] },
      { id: 'q6_next_action', text: "Fecha y detalle próxima acción clave:", type: 'text' },
      { id: 'q7_needs', text: "¿Qué necesitas de FertyFit a futuro?", type: 'textarea' },
      { id: 'q8_testimonial', text: "Testimonio / Feedback (Opcional):", type: 'textarea', optional: true }
    ]
  }
};

// --- Components ---

const Notification = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed top-4 right-4 z-[100] p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right duration-300 ${type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
    {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
    <p className="text-sm font-bold">{message}</p>
    <button onClick={onClose}><X size={16} className="opacity-50 hover:opacity-100" /></button>
  </div>
);

const PhaseIntroModal = ({ phase, onClose }: { phase: number, onClose: (dontShow: boolean) => void }) => {
  const [dontShow, setDontShow] = useState(false);
  const content = [
    { t: 'Bienvenida', d: 'Antes de empezar, configura tu perfil y revisa la introducción.', tasks: ['Rellenar F0', 'Ver Video Bienvenida', 'Iniciar Método'] },
    { t: 'Fase 1: Despertar', d: 'Semanas 1-4. Nos enfocamos en la conciencia corporal y registro.', tasks: ['Registro Diario', 'Detox de Hogar', 'Suplementación Base'] },
    { t: 'Fase 2: Reequilibrio', d: 'Semanas 5-8. Ajustes profundos en nutrición y manejo de estrés.', tasks: ['Analíticas Hormonales', 'Protocolo Microbiota', 'Mindset Fértil'] },
    { t: 'Fase 3: Impulso', d: 'Semanas 9-12. Preparación final y decisión de ruta.', tasks: ['Plan Maestro', 'Relato Clínico', 'Consulta F3'] }
  ];
  const info = content[phase] || content[0];

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2rem] max-w-sm w-full p-8 shadow-2xl relative overflow-hidden border-4 border-white">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F4F0ED] to-white -z-10"></div>
        <button onClick={() => onClose(dontShow)} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm hover:scale-110 transition-transform"><X size={20} className="text-[#95706B]" /></button>

        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-full shadow-lg shadow-rose-100">
            <img src={BRAND_ASSETS[`phase${phase}` as keyof typeof BRAND_ASSETS] || BRAND_ASSETS.phase0} className="w-16 h-16 object-cover" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-[#4A4A4A] mb-2">{info.t}</h2>
        <p className="text-center text-[#5D7180] text-sm mb-8 leading-relaxed">{info.d}</p>

        <div className="bg-[#F4F0ED]/50 rounded-xl p-5 mb-6 border border-[#F4F0ED]">
          <h4 className="text-[10px] uppercase font-bold text-[#95706B] tracking-widest mb-3">Objetivos Clave</h4>
          <ul className="space-y-3">
            {info.tasks.map((task, i) => (
              <li key={i} className="flex items-center gap-3 text-sm font-bold text-[#4A4A4A]">
                <div className="w-5 h-5 rounded-full bg-[#C7958E] text-white flex items-center justify-center text-[10px] shadow-sm">{i + 1}</div>
                {task}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 mb-6 justify-center">
          <input
            type="checkbox"
            id="dontShow"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-[#C7958E] focus:ring-[#C7958E]"
          />
          <label htmlFor="dontShow" className="text-xs text-[#5D7180]">No volver a mostrar esta pantalla</label>
        </div>

        <button onClick={() => onClose(dontShow)} className="w-full bg-[#4A4A4A] text-white py-4 rounded-xl font-bold shadow-xl hover:scale-[1.02] transition-transform">
          ¡Vamos allá!
        </button>
      </div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-full py-2 transition-colors duration-200 ${active ? 'text-[#C7958E]' : 'text-[#5D7180] opacity-60 hover:opacity-100'}`}>
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[10px] mt-1 font-medium uppercase tracking-wide">{label}</span>
  </button>
);

const InputField = ({ label, children }: { label: string; children?: React.ReactNode }) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-[#5D7180] uppercase tracking-wider mb-1">{label}</label>
    {children}
  </div>
);

const StatCard = ({ title, value, target, unit, icon: Icon, hideTarget }: any) => {
  const isGood = target && parseFloat(value) >= parseFloat(target);
  const bgClass = hideTarget ? 'bg-white' : (isGood ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-[#C7958E]');

  return (
    <div className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#F4F0ED] flex items-center justify-between relative overflow-hidden group hover:border-[#C7958E]/30 transition-colors">
      <div className="relative z-10">
        <p className="text-[10px] text-[#5D7180] font-bold uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-lg font-bold text-[#4A4A4A]">{value}</span>
          {unit && <span className="text-xs text-stone-400 ml-1">{unit}</span>}
        </div>
        {!hideTarget && (
          <div className={`text-[10px] mt-1 font-medium ${isGood ? 'text-emerald-500' : 'text-[#95706B]'}`}>Meta: {target} {unit}</div>
        )}
      </div>
      <div className={`p-3.5 rounded-full ${bgClass} relative z-10 shadow-sm`}>
        <Icon size={28} className={hideTarget ? 'text-[#95706B]' : 'currentColor'} strokeWidth={1.5} />
      </div>
    </div>
  );
};

// Notification Card Component
const NotificationCard: React.FC<{ notification: any; onMarkRead: (id: number) => void; deleteNotification: (id: number) => void }> = ({ notification, onMarkRead, deleteNotification }) => {
  const [expanded, setExpanded] = useState(false);

  const getBgColor = () => {
    if (notification.type === 'success') return 'bg-emerald-500';
    if (notification.type === 'alert') return 'bg-rose-500';
    return 'bg-[#C7958E]';
  };

  const getIcon = () => {
    if (notification.type === 'success') return <Sparkles size={16} />;
    if (notification.type === 'alert') return <AlertCircle size={16} />;
    return <Star size={16} />;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={getBgColor()}>
            <span className="text-white text-xs font-bold px-2 py-1 rounded">
              {notification.type === 'celebration' ? 'Celebración' :
                notification.type === 'success' ? 'Éxito' :
                  notification.type === 'alert' ? 'Alerta' :
                    notification.type === 'tip' ? 'Consejo' : notification.type}
            </span>
          </div>
          <h4 className="font-semibold text-[#4A4A4A]">{notification.title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(!expanded)} className="text-[#5D7180]">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={() => deleteNotification(notification.id)} className="text-[#C7958E] hover:text-[#95706B]">
            <Trash size={16} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 text-sm text-[#5D7180] whitespace-pre-wrap">
          {notification.message}
          {!notification.is_read && (
            <button onClick={() => onMarkRead(notification.id)} className="mt-2 block text-[#C7958E] underline">
              Marcar como leída
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Report Card Component
const ReportCard: React.FC<{ report: any }> = ({ report }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-[#F4F0ED] rounded-2xl shadow-sm overflow-hidden transition-all">
      <div onClick={() => setExpanded(!expanded)} className="p-4 cursor-pointer hover:bg-[#F4F0ED]/30 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-full bg-[#95706B]/10 text-[#95706B]">
              <FileText size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#4A4A4A]">{report.form_type || 'Informe'}</p>
              <p className="text-xs text-[#5D7180] mt-1">
                {new Date(report.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report.pdf_url && (
              <a
                href={report.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-full bg-[#C7958E]/10 text-[#C7958E] hover:bg-[#C7958E] hover:text-white transition-colors"
              >
                <Download size={16} />
              </a>
            )}
            {expanded ? <ChevronUp size={20} className="text-[#5D7180]" /> : <ChevronDown size={20} className="text-[#5D7180]" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#F4F0ED] pt-4 bg-[#F9F6F4] space-y-3">
          {report.summary && (
            <div>
              <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Resumen</p>
              <p className="text-sm text-[#4A4A4A] leading-relaxed">{report.summary}</p>
            </div>
          )}

          {report.recommendations && (
            <div>
              <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Recomendaciones</p>
              <p className="text-sm text-[#4A4A4A] leading-relaxed whitespace-pre-wrap">{report.recommendations}</p>
            </div>
          )}

          {report.pdf_url && (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-xs bg-[#C7958E] hover:bg-[#95706B] text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Download size={14} />
              Descargar PDF Completo
            </a>
          )}
        </div>
      )}
    </div>
  );
};

const LogHistoryItem: React.FC<{ log: DailyLog }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-[#F4F0ED] rounded-2xl shadow-sm overflow-hidden transition-all mb-3">
      <div onClick={() => setExpanded(!expanded)} className="p-4 cursor-pointer hover:bg-[#F4F0ED]/30 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Day Circle */}
            <div className="flex flex-col items-center justify-center w-12 h-12 bg-rose-50 rounded-full border border-rose-100">
              <span className="text-xs text-[#C7958E] font-bold">DÍA</span>
              <span className="text-lg font-extrabold text-[#95706B] leading-none">{log.cycleDay}</span>
            </div>

            {/* Main Info */}
            <div>
              <p className="font-bold text-[#4A4A4A] text-sm flex items-center gap-2">
                {new Date(log.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                {log.sex && <Heart size={12} className="text-rose-500 fill-current" />}
              </p>
              <div className="flex items-center gap-3 text-xs text-[#5D7180] mt-1">
                <span className="flex items-center gap-1 bg-[#F4F0ED] px-2 py-0.5 rounded-md"><Thermometer size={10} /> {log.bbt ? `${log.bbt}º` : '--'}</span>
                <span className="flex items-center gap-1 bg-[#F4F0ED] px-2 py-0.5 rounded-md"><Droplets size={10} /> {log.mucus || '--'}</span>
              </div>
            </div>
          </div>

          {/* Indicators */}
          <div className="flex flex-col items-end gap-1">
            {log.symptoms.length > 0 && (
              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <AlertCircle size={10} /> {log.symptoms.length}
              </span>
            )}
            <div className="flex gap-1">
              {[...Array(log.stressLevel || 0)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-300"></div>)}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-[#F4F0ED]/30 text-xs space-y-2 border-t border-[#F4F0ED]">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-white rounded-lg border border-stone-100">
              <span className="block text-stone-400 uppercase text-[9px] font-bold mb-1">Sueño & Energía</span>
              <div className="flex items-center gap-2">
                <Moon size={14} className="text-indigo-300" />
                <span className="font-medium text-stone-600">{log.sleepHours}h <span className="text-stone-300">|</span> Calidad {log.sleepQuality}/5</span>
              </div>
            </div>
            <div className="p-2 bg-white rounded-lg border border-stone-100">
              <span className="block text-stone-400 uppercase text-[9px] font-bold mb-1">Estrés</span>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                <span className="font-medium text-stone-600">Nivel {log.stressLevel}/5</span>
              </div>
            </div>
          </div>
          {(log.cervixHeight || log.cervixFirmness || log.cervixOpenness) && (
            <div className="p-2 bg-white rounded-lg border border-stone-100">
              <span className="block text-stone-400 uppercase text-[9px] font-bold">Cérvix</span>
              <span className="font-medium text-stone-600">{log.cervixHeight || '-'} • {log.cervixFirmness || '-'} • {log.cervixOpenness || '-'}</span>
            </div>
          )}
          {log.symptoms.length > 0 && (
            <div>
              <span className="block text-stone-400 uppercase text-[9px] font-bold mb-1">Síntomas Registrados</span>
              <div className="flex flex-wrap gap-1">
                {log.symptoms.map(s => <span key={s} className="bg-white border border-rose-100 text-[#C7958E] px-2 py-0.5 rounded-md shadow-sm">{s}</span>)}
              </div>
            </div>
          )}
          <div className="p-2 bg-white rounded-lg border border-stone-100 mt-2 flex justify-between">
            <span className="text-stone-400 uppercase text-[9px] font-bold">Consumo de Alcohol</span>
            <span className={`font-bold ${log.alcohol ? 'text-rose-500' : 'text-emerald-500'}`}>{log.alcohol ? 'Sí' : 'No (¡Bien!)'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 bg-white rounded-lg border border-stone-100 flex items-center justify-between">
              <span className="text-stone-400 uppercase text-[9px] font-bold">Movimiento</span>
              <span className="font-bold text-stone-600">{log.activityMinutes}m</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-stone-100 flex items-center justify-between">
              <span className="text-stone-400 uppercase text-[9px] font-bold">Luz Solar</span>
              <span className="font-bold text-stone-600">{log.sunMinutes}m</span>
            </div>
          </div>
          <div className="p-2 bg-white rounded-lg border border-stone-100 mt-2 flex justify-between">
            <span className="text-stone-400 uppercase text-[9px] font-bold">Test LH</span>
            <span className={`font-bold ${log.lhTest === 'Positivo' ? 'text-rose-500' : 'text-stone-600'}`}>{log.lhTest}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const ProfileHeader = ({ user, logsCount, logs, submittedForms }: { user: UserProfile, logsCount: number, logs: DailyLog[], submittedForms: ConsultationForm[] }) => {
  const getDaysActive = () => {
    if (!user.methodStartDate) return 0;
    const start = new Date(user.methodStartDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
  };
  const daysActive = getDaysActive();
  const level = logsCount > 30 ? "Experta" : (logsCount > 7 ? "Comprometida" : "Iniciada");
  const currentWeek = daysActive > 0 ? Math.ceil(daysActive / 7) : 0;

  // Calculate FertyScore
  const scores = calculateFertyScore(user, logs);

  // Get time trying from F0
  const getMonthsTrying = () => {
    const f0Form = submittedForms.find(f => f.form_type === 'F0');
    if (!f0Form) return null;

    const timeTryingAnswer = f0Form.answers.find(a => a.questionId === 'q3_time_trying');
    if (timeTryingAnswer && timeTryingAnswer.answer) {
      return parseInt(timeTryingAnswer.answer as string);
    }
    return null;
  };

  const monthsTrying = getMonthsTrying();

  return (
    <div className="bg-gradient-to-br from-[#C7958E] to-[#95706B] pt-10 pb-8 px-6 rounded-b-[2.5rem] shadow-lg mb-6 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

      <div className="relative z-10">
        {/* Header with name and badge */}
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

        {/* Integrated Profile Info - Like a description */}
        <div className="mb-6 text-sm text-white/90 space-y-1 ml-1">
          <p className="flex items-center gap-2">
            <span className="opacity-75">Objetivo:</span>
            <span className="font-semibold">{user.mainObjective || '-'}</span>
            <span className="opacity-50">•</span>
            <span className="opacity-75">Estado:</span>
            <span className="font-semibold">{user.partnerStatus || '-'}</span>
          </p>
          {monthsTrying !== null && (
            <p className="flex items-center gap-2">
              <span className="opacity-75">Tiempo buscando:</span>
              <span className="font-semibold">{monthsTrying} {monthsTrying === 1 ? 'mes' : 'meses'}</span>
            </p>
          )}
        </div>

        {/* Stats Row - Only box */}
        <div className="flex justify-between bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
          <div className="text-center">
            <p className="text-2xl font-bold">{daysActive}</p>
            <p className="text-[10px] text-rose-100 uppercase tracking-wider font-medium">Días Método</p>
          </div>
          <div className="w-px bg-white/20"></div>
          <div className="text-center">
            <p className="text-2xl font-bold">{logsCount}</p>
            <p className="text-[10px] text-rose-100 uppercase tracking-wider font-medium">Registros</p>
          </div>
          <div className="w-px bg-white/20"></div>
          <div className="text-center">
            <p className="text-2xl font-bold">{currentWeek}</p>
            <p className="text-[10px] text-rose-100 uppercase tracking-wider font-medium">Semana</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

function AppContent() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>('ONBOARDING');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [submittedForms, setSubmittedForms] = useState<ConsultationForm[]>([]);
  const [reports, setReports] = useState<any[]>([]);  // Admin reports
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // New Name State
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [notif, setNotif] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const [courseModules, setCourseModules] = useState<CourseModule[]>([]);
  const [todayLog, setTodayLog] = useState<Partial<DailyLog>>({ date: formatDateForDB(new Date()), cycleDay: 1, symptoms: [], alcohol: false, activityMinutes: 0, sunMinutes: 0, lhTest: 'No realizado' });
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [profileTab, setProfileTab] = useState<'PROFILE' | 'HISTORIA'>('PROFILE');

  // Notification Persistence: Load deleted IDs from localStorage
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<number[]>(() => {
    const stored = localStorage.getItem('fertyfit_deleted_notifications');
    return stored ? JSON.parse(stored) : [];
  });

  // Filter notifications based on blacklist
  const visibleNotifications = notifications.filter(n => !deletedNotificationIds.includes(n.id));

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPartnerStatus, setEditPartnerStatus] = useState('');

  const handleSaveProfile = async () => {
    if (!user) return;

    const { error } = await supabase.from('profiles').update({
      name: editName,
      partner_status: editPartnerStatus
    }).eq('id', user.id);

    if (!error) {
      setUser({ ...user, name: editName, partnerStatus: editPartnerStatus });
      setIsEditingProfile(false);
      showNotif('Perfil actualizado correctamente', 'success');
    } else {
      showNotif('Error al actualizar perfil', 'error');
    }
  };

  // Initialize edit state when entering profile
  useEffect(() => {
    if (user && view === 'PROFILE') {
      setEditName(user.name);
      setEditPartnerStatus(user.partnerStatus || '');
    }
  }, [user, view]);

  useEffect(() => { checkUser(); }, []);

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
            role: profile.role || 'user'
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
          await fetchLogs(session.user.id);
          await fetchUserForms(session.user.id);
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
    }
  };



  const fetchNotifications = async (userId: string) => {
    const { data, error, status, statusText } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });

    if (error) console.error('❌ Error fetching notifications:', error);
    if (data) {
      setNotifications(data);
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
  const deleteNotification = async (notifId: number) => {
    // 1. Update Local State (Blacklist)
    const newDeletedIds = [...deletedNotificationIds, notifId];
    setDeletedNotificationIds(newDeletedIds);
    localStorage.setItem('fertyfit_deleted_notifications', JSON.stringify(newDeletedIds));

    // 2. Optimistic UI Update
    setNotifications(prev => prev.filter(n => n.id !== notifId));

    // 3. Server Delete
    const { error } = await supabase.from('notifications').delete().eq('id', notifId);
    if (error) {
      console.error('Error deleting notification:', error);
    } else {
      console.log('✅ Notification deleted', notifId);
    }
  };

  const analyzeLogsWithAI = async (userId: string, recentLogs: DailyLog[], context: 'f0' | 'f0_update' | 'daily' = 'daily') => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API;
      console.log('🤖 AI Analysis triggered:', { context, userId, apiKey: apiKey ? '✅ Found' : '❌ Missing' });

      if (!apiKey) {
        console.error('❌ Gemini API key not configured. Check .env file for VITE_GEMINI_API');
        return;
      }
      if (context === 'f0' || context === 'f0_update') {
        // Fetch fresh profile data to ensure we have the latest F0 answers
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

        if (!profile) return;

        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // Add randomness to prompt to prevent caching/repetition
        const seed = new Date().getTime();

        const F0_PROMPT = `
        Eres un asistente experto en fertilidad y salud femenina (FertyFit).
        La usuaria ${profile.name} acaba de actualizar su perfil.
        
        DATOS ACTUALES:
        - Edad: ${profile.age} años
        - Objetivo Principal: "${profile.main_objective || 'Mejorar salud hormonal'}"
        - Tiempo buscando: ${profile.time_trying || 'Recién empezando'}
        - Diagnósticos: ${profile.diagnoses && profile.diagnoses.length > 0 ? profile.diagnoses.join(', ') : 'Ninguno'}
        - Estado Civil: ${profile.partner_status || 'No especificado'}
        - Semilla aleatoria: ${seed}
        
        TAREA:
        Genera un mensaje de notificación ÚNICO y PERSONALIZADO (máximo 40 palabras).
        
        REGLAS OBLIGATORIAS:
        1. MENCIONA EXPLÍCITAMENTE su objetivo ("${profile.main_objective}") o sus diagnósticos si los tiene.
        2. NO repitas frases genéricas como "Bienvenida a FertyFit".
        3. Si tiene diagnósticos (SOP, Endometriosis), valida su esfuerzo.
        4. Si lleva tiempo buscando, dale una frase de esperanza específica.
        5. Usa un tono cercano, como una amiga experta.
        6. Usa emojis variados (no siempre los mismos).
        
        Ejemplo malo: "Bienvenida, estamos aquí para ayudarte."
        Ejemplo bueno: "¡Hola ${profile.name}! Veo que tu meta es ${profile.main_objective}. Con tu diagnóstico de SOP, trabajaremos juntas en tu balance hormonal. 💪✨"
      `;

        const response = await fetch(GEMINI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: F0_PROMPT }] }],
            generationConfig: {
              temperature: 0.9, // High creativity to avoid repetition
              maxOutputTokens: 100,
            }
          })
        });

        const data = await response.json();
        const aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text;

        let title = context === 'f0' ? '🌸 Bienvenida a FertyFit' : '✨ Perfil Actualizado';
        let message = aiMessage || (context === 'f0'
          ? '¡Bienvenida! Estamos aquí para acompañarte en tu camino hacia la fertilidad.'
          : 'Hemos actualizado tu perfil. Tus nuevos datos nos ayudarán a darte mejores recomendaciones.');



        // CHECK FOR DUPLICATES BEFORE INSERTING
        // Fix: Use localStorage to prevent re-generation if deleted by user
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
        // FETCH PROFILE DATA (F0) to include context
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

        if (!profile) {
          console.error('❌ No profile found for AI notification');
          return;
        }

        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const SYSTEM_CONTEXT = `
Eres un asistente especializado en fertilidad y salud reproductiva femenina. 
Tu objetivo es analizar datos de seguimiento de fertilidad y proporcionar insights personalizados.

IMPORTANTE:
- Usa un tono cálido, empoderador y profesional
- Sé conciso: máximo 2-3 oraciones por insight
- Enfoca en lo ACCIONABLE, no solo en observaciones
- Usa emojis sutiles para hacer el mensaje más amigable
- NUNCA des diagnósticos médicos
- SIEMPRE recomienda consultar con un profesional si hay algo preocupante
        `;

        // Include F0 profile context
        const profileContext = {
          nombre: profile.name,
          edad: profile.age,
          objetivo: profile.main_objective,
          diagnosticos: profile.diagnoses && profile.diagnoses.length > 0 ? profile.diagnoses.join(', ') : 'Ninguno',
          tiempoBuscando: profile.time_trying || 'No especificado',
          cicloPromedio: profile.cycle_length,
          regularidad: profile.cycle_regularity
        };

        const logSummary = recentLogs.slice(0, 14).map(log => ({
          date: log.date,
          cycleDay: log.cycleDay,
          bbt: log.bbt,
          mucus: log.mucus,
          stress: log.stressLevel,
          sleep: log.sleepHours,
          symptoms: log.symptoms,
          lhTest: log.lhTest,
          alcohol: log.alcohol,
          veggieServings: log.veggieServings
        }));

        // 1. POSITIVE NOTIFICATION
        const POSITIVE_PROMPT = `${SYSTEM_CONTEXT}

CONTEXTO DE LA USUARIA (F0):
${JSON.stringify(profileContext, null, 2)}

DATOS DE LOS ÚLTIMOS 14 DÍAS:
${JSON.stringify(logSummary, null, 2)}

TAREA: Analiza los datos considerando el contexto de la usuaria y encuentra UN ASPECTO POSITIVO específico y personalizado.

Genera SOLO el mensaje (sin título). Máximo 2-3 oraciones. Tono positivo y motivador.`;

        const positiveResponse = await fetch(GEMINI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: POSITIVE_PROMPT }]
            }]
          })
        });

        const positiveData = await positiveResponse.json();
        const positiveMessage = positiveData.candidates?.[0]?.content?.parts?.[0]?.text;

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
        const ALERT_PROMPT = `${SYSTEM_CONTEXT}

CONTEXTO DE LA USUARIA (F0):
${JSON.stringify(profileContext, null, 2)}

DATOS DE LOS ÚLTIMOS 14 DÍAS:
${JSON.stringify(logSummary, null, 2)}

TAREA: Analiza los datos considerando el contexto de la usuaria y encuentra UN ÁREA DE MEJORA prioritaria y personalizada.

Genera SOLO el mensaje (sin título). Máximo 2-3 oraciones. Tono constructivo, no alarmista.`;

        const alertResponse = await fetch(GEMINI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: ALERT_PROMPT }]
            }]
          })
        });

        const alertData = await alertResponse.json();
        const alertMessage = alertData.candidates?.[0]?.content?.parts?.[0]?.text;

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

  const TrackerView = () => {
    // Auto-calculate cycle day when view loads
    useEffect(() => {
      if (todayLog.date && todayLog.cycleDay === 1 && submittedForms.length > 0) {
        // Trigger calculation by calling handleDateChange with current date
        handleDateChange(todayLog.date);
      }
    }, [submittedForms]);

    // Get minimum date (last period date from F0)
    const getMinDate = () => {
      const f0Form = submittedForms.find(f => f.form_type === 'F0');
      if (f0Form) {
        const lastPeriodAnswer = f0Form.answers.find(a => a.questionId === 'q8_last_period');
        if (lastPeriodAnswer && lastPeriodAnswer.answer) {
          return lastPeriodAnswer.answer as string;
        }
      }
      // Fallback: 60 days ago if no F0
      return new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    };

    return (
      <div className="pb-24 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#4A4A4A]">Registro Diario</h2>
          <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-[#5D7180] shadow-sm font-medium">
            {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-[#F4F0ED] space-y-8">
          {/* Fisiología */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-[#95706B] uppercase tracking-widest border-b border-[#F4F0ED] pb-2">Fisiología</h3>

            {/* Cycle Day Display (Auto-calculated) */}
            <div className="flex items-center justify-between bg-[#F4F0ED]/50 p-4 rounded-2xl">
              <div>
                <span className="text-sm font-bold text-[#5D7180] block">Día del Ciclo</span>
                <span className="text-[10px] text-[#C7958E] font-bold bg-[#C7958E]/10 px-2 py-0.5 rounded-full">Automático</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-[#4A4A4A] w-12 text-center">{todayLog.cycleDay || 1}</span>
              </div>
            </div>

            {/* BBT Input (Stepper + Precision) */}
            <div className="flex items-center justify-between bg-[#F4F0ED]/50 p-4 rounded-2xl">
              <span className="text-sm font-bold text-[#5D7180]">Temperatura Basal</span>
              <div className="flex items-center gap-4">
                <button onClick={() => setTodayLog({ ...todayLog, bbt: parseFloat(Math.max(35.0, (todayLog.bbt || 36.5) - 0.1).toFixed(2)) })} className="p-2 bg-white rounded-full shadow-sm text-[#95706B] hover:scale-110 transition-transform"><Minus size={18} /></button>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="35.00"
                    max="40.00"
                    placeholder="36.50"
                    value={todayLog.bbt || ''}
                    onChange={e => setTodayLog({ ...todayLog, bbt: parseFloat(e.target.value) })}
                    className="w-20 text-center bg-transparent text-2xl font-bold text-[#C7958E] outline-none border-b border-transparent focus:border-[#C7958E] transition-colors p-0"
                  />
                  <span className="absolute -right-4 top-1 text-xs font-bold text-[#95706B]">°C</span>
                </div>
                <button onClick={() => setTodayLog({ ...todayLog, bbt: parseFloat(Math.min(40.0, (todayLog.bbt || 36.5) + 0.1).toFixed(2)) })} className="p-2 bg-white rounded-full shadow-sm text-[#95706B] hover:scale-110 transition-transform"><Plus size={18} /></button>
              </div>
            </div>

            <InputField label="Moco Cervical"><div className="flex flex-wrap gap-2">{MUCUS_OPTIONS.map(o => <button key={o} onClick={() => setTodayLog({ ...todayLog, mucus: o as MucusType })} className={'text-xs px-4 py-2 rounded-full border transition-all font-medium ' + (todayLog.mucus === o ? 'bg-[#C7958E] text-white border-[#C7958E]' : 'bg-white border-[#F4F0ED] text-[#5D7180] hover:border-[#C7958E]')}>{o}</button>)}</div></InputField>

            <InputField label="Test LH">
              <div className="flex flex-wrap gap-2">
                {LH_OPTIONS.map(o => (
                  <button key={o} onClick={() => setTodayLog({ ...todayLog, lhTest: o as LHResult })} className={'text-xs px-4 py-2 rounded-full border transition-all font-medium ' + (todayLog.lhTest === o ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-[#F4F0ED] text-[#5D7180] hover:border-indigo-200')}>{o}</button>

                ))}
              </div>
            </InputField>

            <div className="bg-[#F4F0ED]/50 p-4 rounded-xl border border-[#F4F0ED]">
              <span className="text-xs font-bold text-[#5D7180] block mb-3 uppercase">Cérvix (Opcional)</span>
              <div className="grid grid-cols-3 gap-2">
                <select className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]" value={todayLog.cervixHeight} onChange={e => setTodayLog({ ...todayLog, cervixHeight: e.target.value as any })}><option value="">Altura...</option>{CERVIX_HEIGHT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
                <select className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]" value={todayLog.cervixFirmness} onChange={e => setTodayLog({ ...todayLog, cervixFirmness: e.target.value as any })}><option value="">Firmeza...</option>{CERVIX_FIRM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
                <select className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]" value={todayLog.cervixOpenness} onChange={e => setTodayLog({ ...todayLog, cervixOpenness: e.target.value as any })}><option value="">Apertura...</option>{CERVIX_OPEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
              </div>
            </div>

            <div className="flex items-center justify-between bg-rose-50/50 p-4 rounded-xl border border-rose-100/50">
              <span className="font-bold text-[#95706B] text-sm">Relaciones Sexuales</span>
              <button onClick={() => setTodayLog({ ...todayLog, sex: !todayLog.sex })} className={'w-12 h-6 rounded-full relative transition-colors duration-300 ' + (todayLog.sex ? 'bg-[#C7958E]' : 'bg-stone-200')}><div className={'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ' + (todayLog.sex ? 'left-7' : 'left-1')}></div></button>
            </div>
          </div>

          {/* Estilo de Vida */}
          <div className="space-y-6 border-t border-[#F4F0ED] pt-6">
            <h3 className="text-xs font-bold text-[#95706B] uppercase tracking-widest">Hábitos & Bienestar</h3>

            {/* Sleep Slider */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-[#5D7180]">Horas de Sueño</span>
                <span className="text-sm font-bold text-[#4A4A4A]">{todayLog.sleepHours || 0}h</span>
              </div>
              <input type="range" min="0" max="12" step="0.5" value={todayLog.sleepHours || 7} onChange={e => setTodayLog({ ...todayLog, sleepHours: parseFloat(e.target.value) })} className="w-full accent-[#5D7180] h-2 bg-[#F4F0ED] rounded-lg appearance-none cursor-pointer" />
              <div className="flex justify-between text-[10px] text-stone-400 mt-1"><span>0h</span><span>6h</span><span>12h</span></div>
            </div>

            {/* Stress Segmented Control */}
            <div>
              <span className="text-sm font-bold text-[#5D7180] block mb-2">Nivel de Estrés</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setTodayLog({ ...todayLog, stressLevel: n })}
                    className={'flex-1 h-10 rounded-xl font-bold transition-all ' + (todayLog.stressLevel === n ? 'bg-[#C7958E] text-white shadow-lg scale-105' : 'bg-[#F4F0ED] text-[#5D7180] hover:bg-stone-200')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity & Sun Sliders */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="text-sm font-bold text-[#5D7180] block mb-2">Actividad (min)</span>
                <input type="range" min="0" max="120" step="15" value={todayLog.activityMinutes || 0} onChange={e => setTodayLog({ ...todayLog, activityMinutes: parseInt(e.target.value) })} className="w-full accent-[#C7958E] h-2 bg-[#F4F0ED] rounded-lg appearance-none cursor-pointer" />
                <p className="text-center text-xs font-bold text-[#C7958E] mt-1">{todayLog.activityMinutes || 0} min</p>
              </div>
              <div>
                <span className="text-sm font-bold text-[#5D7180] block mb-2">Luz Solar (min)</span>
                <input type="range" min="0" max="60" step="5" value={todayLog.sunMinutes || 0} onChange={e => setTodayLog({ ...todayLog, sunMinutes: parseInt(e.target.value) })} className="w-full accent-amber-400 h-2 bg-[#F4F0ED] rounded-lg appearance-none cursor-pointer" />
                <p className="text-center text-xs font-bold text-amber-500 mt-1">{todayLog.sunMinutes || 0} min</p>
              </div>
            </div>

            {/* Water & Veggies Counters */}
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-bold text-[#5D7180]">Agua (Vasos)</span>
                  <span className="text-xs font-bold text-blue-500">{todayLog.waterGlasses || 0} / 8</span>
                </div>
                <div className="flex justify-between">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button key={n} onClick={() => setTodayLog({ ...todayLog, waterGlasses: n === todayLog.waterGlasses ? n - 1 : n })} className="hover:scale-110 transition-transform">
                      <Droplets size={20} className={n <= (todayLog.waterGlasses || 0) ? "text-blue-400 fill-blue-400" : "text-blue-200"} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-bold text-[#5D7180]">Vegetales (Raciones)</span>
                  <span className="text-xs font-bold text-emerald-600">{todayLog.veggieServings || 0} / 5</span>
                </div>
                <div className="flex justify-start gap-4">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setTodayLog({ ...todayLog, veggieServings: n === todayLog.veggieServings ? n - 1 : n })} className="hover:scale-110 transition-transform">
                      <Leaf size={24} className={n <= (todayLog.veggieServings || 0) ? "text-emerald-500 fill-emerald-500" : "text-emerald-200"} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white border border-[#F4F0ED] p-4 rounded-xl">
              <span className="font-bold text-[#5D7180] text-sm">Consumo de Alcohol</span>
              <button onClick={() => setTodayLog({ ...todayLog, alcohol: !todayLog.alcohol })} className={'w-12 h-6 rounded-full relative transition-colors duration-300 ' + (todayLog.alcohol ? 'bg-[#C7958E]' : 'bg-stone-200')}><div className={'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ' + (todayLog.alcohol ? 'left-7' : 'left-1')}></div></button>
            </div>
          </div>

          <button onClick={saveDailyLog} className="w-full bg-[#4A4A4A] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition-colors mt-4">Guardar Registro Diario</button>
        </div >

        <div>
          <h3 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2 text-sm uppercase tracking-wider opacity-80">Historial Reciente</h3>
          <div className="space-y-2">
            {logs.slice(0, 7).map(log => <LogHistoryItem key={log.date} log={log} />)}
          </div>
        </div>
      </div >
    );
  };

  const EducationView = () => {
    const phases = [
      { id: 0, title: "Bienvenida", range: "Inicio", color: "bg-[#C7958E]", icon: BRAND_ASSETS.phase0 },
      { id: 1, title: "Fase 1: Despertar", range: "Semana 1-4", color: "bg-[#95706B]", icon: BRAND_ASSETS.phase1 },
      { id: 2, title: "Fase 2: Reequilibrio", range: "Semana 5-8", color: "bg-[#5D7180]", icon: BRAND_ASSETS.phase2 },
      { id: 3, title: "Fase 3: Impulso", range: "Semana 9-12", color: "bg-[#4A4A4A]", icon: BRAND_ASSETS.phase3 }
    ];

    return (
      <div className="pb-24 space-y-8">
        <h2 className="text-xl font-bold text-[#4A4A4A]">Tu Programa</h2>
        {phases.map(phase => {
          const phaseModules = courseModules.filter(m => m.phase === phase.id);
          if (phaseModules.length === 0 && phase.id !== 0) return null;

          return (
            <div key={phase.id} className="space-y-4">
              <div className="rounded-2xl p-1 flex items-center gap-4">
                <img src={phase.icon} alt="" className="w-12 h-12 rounded-full object-cover shadow-sm border-2 border-white" />
                <div>
                  <h3 className="font-bold text-lg text-[#4A4A4A]">{phase.title}</h3>
                  <p className="text-xs text-[#5D7180] uppercase font-medium tracking-wider">{phase.range}</p>
                </div>
              </div>
              <div className="space-y-3 pl-2">
                {phaseModules.map(mod => (
                  <div key={mod.id} className={'relative bg-white border rounded-xl p-5 transition-all ' + (mod.isLocked ? 'opacity-60 grayscale' : 'shadow-[0_2px_15px_rgba(0,0,0,0.03)] border-[#F4F0ED]')}>
                    {mod.isLocked && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl">
                        <div className="bg-[#4A4A4A]/80 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-sm">
                          <Lock size={14} /> Bloqueado
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-[#4A4A4A] text-sm">{mod.title}</h4>
                      {mod.order_index > 0 && <span className="text-[10px] bg-[#F4F0ED] px-2 py-1 rounded text-[#95706B] font-bold">SEM {mod.order_index}</span>}
                    </div>
                    <p className="text-xs text-[#5D7180] mb-4 leading-relaxed">{mod.description}</p>
                    {!mod.isLocked && (
                      <div className="space-y-2">
                        {mod.lessons.map(l => {
                          const isCompleted = mod.completedLessons.includes(l.id);
                          return (
                            <div key={l.id} onClick={() => setActiveLesson(l)} className="flex items-center gap-3 text-xs text-[#5D7180] p-3 bg-[#F4F0ED]/50 rounded-lg hover:bg-[#C7958E]/10 cursor-pointer border border-transparent hover:border-[#C7958E]/30 transition-all group">
                              <div className={'p-1.5 rounded-full shadow-sm transition-transform group-hover:scale-110 ' + (isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-[#C7958E]')}>
                                {isCompleted ? <CheckCircle size={14} /> : (l.type === 'video' ? <PlayCircle size={14} /> : <PdfIcon size={14} />)}
                              </div>
                              <span className="font-medium flex-1">{l.title}</span>
                              <span className="text-[#95706B] opacity-70">{l.duration}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const ConsultationsView = () => {
    const daysActive = user?.methodStartDate ? Math.floor((new Date().getTime() - new Date(user.methodStartDate).getTime()) / (1000 * 3600 * 24)) : 0;
    const canAccessF1 = daysActive >= 30;
    const canAccessF2 = daysActive >= 60;
    const canAccessF3 = daysActive >= 90;
    const [formType, setFormType] = useState<'F0' | 'F1' | 'F2' | 'F3'>('F0');
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isEditMode, setIsEditMode] = useState(false);

    const isLocked = (formType === 'F1' && !canAccessF1) || (formType === 'F2' && !canAccessF2) || (formType === 'F3' && !canAccessF3);
    const definition = FORM_DEFINITIONS[formType];

    // Check if already submitted
    const submittedForm = submittedForms.find(f => f.form_type === formType);
    const isPdfGenerated = submittedForm?.generated_pdf_url;

    useEffect(() => {
      if (submittedForm) {
        const loaded: Record<string, any> = {};
        if (Array.isArray(submittedForm.answers)) {
          submittedForm.answers.forEach((a: any) => {
            loaded[a.questionId] = a.answer;
          });
        }
        setAnswers(loaded);
      } else {
        setAnswers({});
      }
      // Reset edit mode when changing forms
      setIsEditMode(false);
    }, [formType, submittedForm]);

    const handleSubmit = async () => {
      if (!user?.id) return;

      if (isPdfGenerated) {
        showNotif("El informe ya ha sido generado. No se pueden modificar los datos.", 'error');
        return;
      }

      // Validation: Check required fields
      const missingRequired = definition.questions.filter(q => {
        // @ts-ignore
        if (q.optional) return false;
        const value = answers[q.id];
        return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
      });

      if (missingRequired.length > 0) {
        const missingText = missingRequired.length > 3
          ? missingRequired.length + ' campos obligatorios'
          : missingRequired.map(q => q.text.replace(':', '')).join(', ');
        showNotif('Faltan campos obligatorios: ' + missingText, 'error');
        return;
      }

      const formattedAnswers = definition.questions.map(q => ({ questionId: q.id, question: q.text, answer: answers[q.id] || '' }));

      let error;
      if (submittedForm) {
        const { error: updateError } = await supabase.from('consultation_forms').update({
          answers: formattedAnswers,
          status: 'pending',
          snapshot_stats: calculateAverages(logs)
        }).eq('id', submittedForm.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('consultation_forms').insert({
          user_id: user.id,
          form_type: formType,
          answers: formattedAnswers,
          status: 'pending',
          snapshot_stats: calculateAverages(logs)
        });
        error = insertError;
      }

      if (!error) {
        // IF F0, UPDATE PROFILE SYNC IMMEDIATELY
        if (formType === 'F0') {
          const updates: any = {};

          // Basic info
          if (answers['q1_birthdate']) {
            const birthDate = new Date(answers['q1_birthdate'] as string);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            updates.age = age;
          }
          if (answers['q2_weight']) updates.weight = parseFloat(answers['q2_weight']);
          if (answers['q2_height']) updates.height = parseFloat(answers['q2_height']);
          if (answers['q3_time_trying']) updates.time_trying = answers['q3_time_trying'] + ' meses';

          // Objectives and status
          if (answers['q4_objective']) updates.main_objective = answers['q4_objective'];
          if (answers['q5_partner']) updates.partner_status = answers['q5_partner'];

          // Cycle info
          if (answers['q6_cycle']) updates.cycle_length = parseInt(answers['q6_cycle'] as string);
          if (answers['q7_regularity']) updates.cycle_regularity = answers['q7_regularity'];
          if (answers['q8_last_period']) updates.last_period_date = answers['q8_last_period'];

          // Health info
          if (answers['q9_diagnoses']) {
            updates.obstetric_history = answers['q9_diagnoses'];
          }
          if (answers['q19_supplements']) updates.supplements = answers['q19_supplements'];
          if (answers['q20_fertility_treatments']) updates.fertility_treatments = answers['q20_fertility_treatments'];
          if (answers['q21_family_history']) updates.family_history = answers['q21_family_history'];

          // Lifestyle
          if (answers['q17_smoker']) updates.smoker = answers['q17_smoker'];
          if (answers['q18_alcohol']) updates.alcohol_consumption = answers['q18_alcohol'];

          if (Object.keys(updates).length > 0) {
            await supabase.from('profiles').update(updates).eq('id', user.id);
            // Force update local state immediately for UI
            setUser(prev => prev ? ({ ...prev, ...updates }) : null);
          }

          // CRITICAL: Recalculate cycle day for ALL existing logs when last_period_date changes
          if (answers['q8_last_period']) {
            const lastPeriodDate = new Date(answers['q8_last_period'] as string);
            const cycleDuration = answers['q6_cycle'] ? parseInt(answers['q6_cycle'] as string) : 28;

            // Get all existing logs
            const { data: existingLogs } = await supabase
              .from('daily_logs')
              .select('*')
              .eq('user_id', user.id);

            if (existingLogs && existingLogs.length > 0) {
              // Recalculate cycle day for each log
              const updates = existingLogs.map(log => {
                const logDate = new Date(log.date);
                const diff = Math.floor((logDate.getTime() - lastPeriodDate.getTime()) / (1000 * 3600 * 24));
                const newCycleDay = diff >= 0 ? (diff % cycleDuration) + 1 : 1;

                return {
                  id: log.id,
                  cycle_day: newCycleDay
                };
              });

              // Batch update all logs
              for (const update of updates) {
                await supabase
                  .from('daily_logs')
                  .update({ cycle_day: update.cycle_day })
                  .eq('id', update.id);
              }

              // AUTOMATIC REFRESH: Update local state immediately without reload
              const { data: refreshedLogs } = await supabase
                .from('daily_logs')
                .select('*')
                .eq('user.id', user.id)
                .order('date', { ascending: false });

              if (refreshedLogs) {
                const mappedLogs = refreshedLogs.map(mapLogFromDB);
                setLogs(mappedLogs);

                // Update todayLog if it exists in the refreshed logs
                const todayStr = formatDateForDB(new Date());
                const existingToday = mappedLogs.find(l => l.date === todayStr);
                if (existingToday) {
                  setTodayLog(existingToday);
                }
              }

              showNotif('Días del ciclo actualizados correctamente', 'success');
            }
          }

          // Generate AI notification: first time OR one update allowed
          const { data: profileData } = await supabase.from('profiles').select('f0_ai_count').eq('id', user.id).single();
          const f0AiCount = profileData?.f0_ai_count || 0;

          if (f0AiCount === 0) {
            // First time completing F0
            analyzeLogsWithAI(user.id, [], 'f0');
            await supabase.from('profiles').update({ f0_ai_count: 1 }).eq('id', user.id);
          } else if (f0AiCount === 1 && submittedForm) {
            // First update of F0 (only once)
            analyzeLogsWithAI(user.id, [], 'f0_update');
            await supabase.from('profiles').update({ f0_ai_count: 2 }).eq('id', user.id);
          }
          // If f0_ai_count >= 2, no more AI notifications for F0 updates
        }
        showNotif(submittedForm ? "Formulario actualizado correctamente." : "Formulario enviado correctamente.", 'success');
        // setAnswers({}); // Don't clear answers so user can see what they submitted/updated
        fetchUserForms(user.id);

        // Redirect to DASHBOARD after F0 submission
        if (formType === 'F0') {
          setTimeout(() => setView('DASHBOARD'), 1500);
        }
      } else {
        showNotif(error.message, 'error');
      }
    };

    return (
      <div className="pb-24 space-y-6">
        <h2 className="text-xl font-bold text-[#4A4A4A]">Consultas</h2>
        <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-[#F4F0ED] overflow-x-auto">
          {[{ id: 'F0', l: 'F0 Base' }, { id: 'F1', l: 'F1 (30d)' }, { id: 'F2', l: 'F2 (60d)' }, { id: 'F3', l: 'F3 (90d)' }].map(t => (
            <button key={t.id} onClick={() => setFormType(t.id as any)} className={'flex-1 py-2 px-3 text-xs font-bold rounded-lg whitespace-nowrap transition-all ' + (formType === t.id ? 'bg-[#C7958E] text-white shadow-md' : 'text-[#5D7180] hover:bg-[#F4F0ED]')}>
              {t.l} {submittedForms.find(f => f.form_type === t.id) && '✅'}
            </button>
          ))}
        </div>

        {isLocked ? (
          <div className="bg-white p-10 rounded-3xl shadow-sm border border-[#F4F0ED] text-center">
            <div className="bg-[#F4F0ED] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={24} className="text-[#95706B]" />
            </div>
            <h3 className="font-bold text-[#4A4A4A] text-lg">Consulta Bloqueada</h3>
            <p className="text-sm text-[#5D7180] mt-2 px-4">Estará disponible cuando avances en el método.</p>
            <div className="mt-6 inline-flex items-center gap-2 bg-[#F4F0ED] px-4 py-2 rounded-full text-xs font-bold text-[#95706B]">
              <Activity size={12} /> Tu progreso actual: {daysActive} días
            </div>
          </div>
        ) : (submittedForm && isPdfGenerated) ? (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
            <div className="flex justify-between items-center mb-4 border-b border-[#F4F0ED] pb-4">
              <h3 className="font-bold text-lg text-[#4A4A4A]">{definition.title}</h3>
              <span className="bg-emerald-100 text-emerald-600 text-[10px] px-3 py-1 rounded-full font-bold border border-emerald-200 flex items-center gap-1"><CheckCircle size={10} /> ENVIADO</span>
            </div>
            <div className="space-y-4 opacity-80">
              {(submittedForm.answers as any[]).map((ans: any) => (
                <div key={ans.questionId} className="bg-[#F4F0ED]/30 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-[#95706B] mb-1">{ans.question}</p>
                  <p className={'text-sm font-medium ' + (!ans.answer ? 'text-stone-400 italic' : 'text-[#4A4A4A]')}>
                    {Array.isArray(ans.answer) ? ans.answer.join(', ') : (ans.answer || "Sin respuesta")}
                  </p>
                </div>
              ))}
            </div>
            {submittedForm.status === 'pending' && (
              <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3">
                <div className="bg-yellow-100 p-2 rounded-full text-yellow-600"><Clock size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-yellow-800">En Revisión</p>
                  <p className="text-[10px] text-yellow-700 mt-1">Recibirás una notificación cuando tu informe PDF esté listo para descargar.</p>
                </div>
              </div>
            )}
            {submittedForm.status === 'reviewed' && (
              <div className="mt-6 bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
                <p className="text-sm font-bold text-emerald-700 mb-2">¡Informe Listo!</p>
                <button className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 mx-auto">
                  <Download size={16} /> Descargar Informe PDF
                </button>
              </div>
            )}
          </div>
        ) : (submittedForm && !isEditMode) ? (
          // SUMMARY VIEW - Show submitted data with edit button
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
            <div className="flex justify-between items-start mb-4 border-b border-[#F4F0ED] pb-4">
              <div>
                <h3 className="font-bold text-lg text-[#4A4A4A]">{definition.title}</h3>
                <p className="text-xs text-[#5D7180] mt-1">
                  Registrado: {new Date(submittedForm.submitted_at || '').toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <button
                onClick={() => setIsEditMode(true)}
                className="bg-[#C7958E] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#95706B] transition-colors flex items-center gap-2"
              >
                <FileText size={16} />
                Editar
              </button>
            </div>

            <div className="space-y-3">
              {(submittedForm.answers as any[]).map((ans: any) => {
                const question = definition.questions.find(q => q.id === ans.questionId);
                if (!question) return null;

                let displayValue = ans.answer;

                // Format dates
                if (question.type === 'date' && typeof displayValue === 'string') {
                  displayValue = new Date(displayValue).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });
                }

                // Format arrays
                if (Array.isArray(displayValue)) {
                  displayValue = displayValue.join(', ');
                }

                return (
                  <div key={ans.questionId} className="bg-[#F4F0ED]/30 p-4 rounded-xl">
                    <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">
                      {question.text}
                    </p>
                    <p className={'text-sm font-medium ' + (!displayValue ? 'text-stone-400 italic' : 'text-[#4A4A4A]')}>
                      {displayValue || "Sin respuesta"}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                <CheckCircle size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-800">Datos Guardados</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Tus datos están registrados. Puedes editarlos cuando quieras.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // FORM VIEW - Show editable form
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
            <h3 className="font-bold text-lg text-[#C7958E] mb-1">{definition.title}</h3>
            {/* @ts-ignore */}
            {/* @ts-ignore */}
            <p className="text-xs text-[#5D7180] mb-6 border-b border-[#F4F0ED] pb-4">{definition.description || "Rellena los datos para tu evaluación."}</p>

            {submittedForm && !isPdfGenerated && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 p-3 rounded-xl flex items-center gap-3 text-xs text-yellow-800">
                <AlertCircle size={16} />
                <span>Puedes editar tus respuestas hasta que el especialista genere el informe.</span>
              </div>
            )}
            <div className="space-y-6">
              {definition.questions.map(q => (
                <div key={q.id}>
                  <label className="block text-xs font-bold text-[#4A4A4A] mb-2 uppercase tracking-wide">{q.text}</label>
                  {q.type === 'textarea' ? (
                    <textarea
                      value={answers[q.id] || ''}
                      className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm h-28 bg-[#F4F0ED]/30 focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E] outline-none transition-all"
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  ) : q.type === 'yesno' ? (
                    <div className="flex gap-3">
                      <button onClick={() => setAnswers({ ...answers, [q.id]: 'Sí' })} className={'flex-1 py-3 text-sm border rounded-xl transition-all font-bold ' + (answers[q.id] === 'Sí' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'border-[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]')}>Sí</button>
                      <button onClick={() => setAnswers({ ...answers, [q.id]: 'No' })} className={'flex-1 py-3 text-sm border rounded-xl transition-all font-bold ' + (answers[q.id] === 'No' ? 'bg-rose-50 border-rose-400 text-rose-500' : 'border-[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]')}>No</button>
                    </div>
                  ) : q.type === 'buttons' ? (
                    <div className="flex gap-3">
                      {q.options?.map(option => (
                        <button
                          key={option}
                          onClick={() => setAnswers({ ...answers, [q.id]: option })}
                          className={'flex-1 py-3 text-sm border rounded-xl transition-all font-bold ' + (answers[q.id] === option ? 'bg-[#C7958E] border-[#C7958E] text-white' : 'border-[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]')}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : q.type === 'stepper' ? (
                    <div className="flex items-center justify-center gap-4 bg-[#F4F0ED]/30 rounded-xl p-4">
                      <button
                        onClick={() => setAnswers({ ...answers, [q.id]: Math.max((q.min || 0), (parseInt(answers[q.id]) || q.min || 0) - 1) })}
                        className="w-12 h-12 rounded-full bg-white border-2 border-[#F4F0ED] text-[#C7958E] font-bold text-xl hover:bg-[#F4F0ED] transition-all shadow-sm"
                      >
                        −
                      </button>
                      <div className="text-center min-w-[100px]">
                        <div className="text-3xl font-bold text-[#4A4A4A]">{answers[q.id] || q.min || 0}</div>
                        <div className="text-xs text-[#5D7180] mt-1">{q.unit}</div>
                      </div>
                      <button
                        onClick={() => setAnswers({ ...answers, [q.id]: Math.min((q.max || 100), (parseInt(answers[q.id]) || q.min || 0) + 1) })}
                        className="w-12 h-12 rounded-full bg-white border-2 border-[#F4F0ED] text-[#C7958E] font-bold text-xl hover:bg-[#F4F0ED] transition-all shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  ) : q.type === 'slider' ? (
                    <div className="bg-[#F4F0ED]/30 rounded-xl p-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-bold text-[#5D7180]">{q.text.replace(':', '')}</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">{answers[q.id] || q.min || 0} {q.unit}</span>
                      </div>
                      <input
                        type="range"
                        min={q.min || 0}
                        max={q.max || 100}
                        step={q.step || 1}
                        value={answers[q.id] || q.min || 0}
                        onChange={e => setAnswers({ ...answers, [q.id]: parseFloat(e.target.value) })}
                        className="w-full accent-[#C7958E] h-2 bg-white rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                        <span>{q.min} {q.unit}</span>
                        <span>{q.max} {q.unit}</span>
                      </div>
                    </div>
                  ) : q.type === 'segmented' ? (
                    <div className="flex gap-2">
                      {Array.from({ length: (q.max || 5) - (q.min || 1) + 1 }, (_, i) => i + (q.min || 1)).map(n => (
                        <button
                          key={n}
                          onClick={() => setAnswers({ ...answers, [q.id]: n })}
                          className={'flex-1 h-12 rounded-xl font-bold transition-all ' + (answers[q.id] === n ? 'bg-[#C7958E] text-white shadow-lg scale-105' : 'bg-[#F4F0ED] text-[#5D7180] hover:bg-stone-200')}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : q.type === 'date' ? (
                    <input
                      type="date"
                      value={answers[q.id] || ''}
                      className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-[#F4F0ED]/30 focus:border-[#C7958E] outline-none transition-all"
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  ) : (
                    <input
                      type={q.type === 'number' ? 'number' : 'text'}
                      value={answers[q.id] || ''}
                      className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-[#F4F0ED]/30 focus:border-[#C7958E] outline-none transition-all"
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <button onClick={handleSubmit} className="w-full bg-[#4A4A4A] text-white py-4 rounded-xl font-bold shadow-lg mt-6 hover:bg-black transition-all flex items-center justify-center gap-2">
                Enviar a Revisión <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };



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
        {view === 'PROFILE' && <ProfileHeader user={user} logsCount={logs.length} logs={logs} submittedForms={submittedForms} />}
        <div className="p-5">
          {view === 'DASHBOARD' && (
            <div className="space-y-6 pb-24 pt-4">
              <header className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-[#4A4A4A]">Hola, {user.name.split(' ')[0]}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={'w-2 h-2 rounded-full ' + (user.methodStartDate ? 'bg-[#C7958E] animate-pulse' : 'bg-stone-300')}></span>
                    <p className="text-xs text-[#5D7180] font-medium uppercase tracking-wide">
                      {user.methodStartDate
                        ? (() => {
                          const start = new Date(user.methodStartDate);
                          start.setHours(0, 0, 0, 0);
                          const now = new Date();
                          now.setHours(0, 0, 0, 0);
                          const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
                          return 'Día ' + days + ' del Método';
                        })()
                        : 'Método no iniciado'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const hasF0 = submittedForms.some(f => f.form_type === 'F0');
                    if (!hasF0) {
                      showNotif('Debes completar el F0 antes de registrar datos diarios', 'error');
                      setView('CONSULTATIONS');
                    } else {
                      setView('TRACKER');
                    }
                  }}
                  className="bg-[#C7958E] text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-rose-200 hover:scale-105 transition-transform"
                >
                  <Activity size={20} />
                </button>
              </header>


              {/* DASHBOARD REDESIGN */}
              {(() => {
                const scores = calculateFertyScore(user, logs);
                const alerts = getAlertsAndOpportunities(user, logs, scores);

                const getDaysActive = () => {
                  if (!user.methodStartDate) return 0;
                  const start = new Date(user.methodStartDate);
                  start.setHours(0, 0, 0, 0);
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  return Math.floor((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
                };
                const daysActive = getDaysActive();
                const progressPercent = Math.min(100, (daysActive / 90) * 100);

                // Score Color Logic
                const getScoreColor = (s: number) => {
                  if (s < 40) return 'text-rose-500';
                  if (s < 70) return 'text-amber-500';
                  return 'text-emerald-500';
                };
                const getScoreBg = (s: number) => {
                  if (s < 40) return 'bg-rose-500';
                  if (s < 70) return 'bg-amber-500';
                  return 'bg-emerald-500';
                };
                const getScoreBorder = (s: number) => {
                  if (s < 40) return 'border-rose-100';
                  if (s < 70) return 'border-amber-100';
                  return 'border-emerald-100';
                };

                return (
                  <div className="space-y-6">
                    {/* START METHOD CARD-Only shown when method not started */}
                    {!user.methodStartDate && (
                      <div className="bg-gradient-to-br from-[#C7958E] to-[#95706B] p-8 rounded-[2rem] shadow-xl text-white text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                        <div className="relative z-10">
                          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                            <Activity size={32} className="text-white" />
                          </div>
                          <h3 className="text-2xl font-bold mb-2">¡Comienza Tu Viaje!</h3>
                          <p className="text-sm opacity-90 mb-6 leading-relaxed">
                            Inicia el Método FertyFit y empieza a registrar tu progreso hacia la fertilidad óptima.
                          </p>
                          <button
                            onClick={startMethod}
                            className="bg-white text-[#C7958E] px-8 py-4 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
                          >
                            <Activity size={20} />
                            Iniciar Método
                          </button>
                        </div>
                      </div>
                    )}

                    {/* MAIN SCORE CARD (Redesigned) */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#F4F0ED] relative overflow-hidden">

                      {/* Ferty Score Circle */}
                      <div className="flex flex-col items-center justify-center mb-8">
                        <h3 className="font-bold text-[#4A4A4A] text-lg mb-2">Tu FertyScore</h3>
                        <div className="bg-gradient-to-br from-[#C7958E] to-[#95706B] text-white w-24 h-24 rounded-full flex items-center justify-center font-bold text-4xl shadow-xl shadow-rose-200 border-4 border-white">
                          {scores.total}
                        </div>
                        <p className="text-xs text-[#5D7180] mt-2">Puntuación Global</p>
                      </div>

                      {/* 4 Pillars (Text Only) */}
                      <div className="flex justify-between items-center bg-[#F4F0ED]/50 p-4 rounded-2xl mb-6">
                        <div className="text-center">
                          <span className="block text-lg font-bold text-[#4A4A4A]">{scores.function}</span>
                          <span className="text-[10px] text-[#95706B] font-bold uppercase">Function</span>
                        </div>
                        <div className="w-px h-8 bg-stone-200"></div>
                        <div className="text-center">
                          <span className="block text-lg font-bold text-[#4A4A4A]">{scores.food}</span>
                          <span className="text-[10px] text-[#95706B] font-bold uppercase">Food</span>
                        </div>
                        <div className="w-px h-8 bg-stone-200"></div>
                        <div className="text-center">
                          <span className="block text-lg font-bold text-[#4A4A4A]">{scores.flora}</span>
                          <span className="text-[10px] text-[#95706B] font-bold uppercase">Flora</span>
                        </div>
                        <div className="w-px h-8 bg-stone-200"></div>
                        <div className="text-center">
                          <span className="block text-lg font-bold text-[#4A4A4A]">{scores.flow}</span>
                          <span className="text-[10px] text-[#95706B] font-bold uppercase">Flow</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="bg-[#F9F6F4] p-4 rounded-xl border border-[#F4F0ED]">
                        <div className="flex justify-between text-xs text-[#95706B] font-bold mb-2 uppercase tracking-wide">
                          <span>Progreso del Método</span>
                          <span>{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-[#F4F0ED]">
                          <div className="h-full bg-[#9ECCB4] rounded-full transition-all duration-1000" style={{ width: progressPercent + '%' }}></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-[#5D7180] mt-1">
                          <span>{daysActive}/90 días</span>
                        </div>
                      </div>
                    </div>

                    {/* ALERTS & OPPORTUNITIES */}
                    <div>
                      <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Alertas y Oportunidades</h3>
                      {(alerts.length > 0 || notifications.filter(n => !n.is_read).length > 0) ? (
                        <div className="flex overflow-x-auto gap-4 pb-4 snap-x custom-scrollbar">
                          {/* AI Notifications */}
                          {notifications.filter(n => !n.is_read).map(notif => (
                            <div key={notif.id} className="snap-center min-w-[280px] p-5 rounded-2xl shadow-sm border flex flex-col justify-between bg-gradient-to-br from-purple-600 to-indigo-600 text-white border-purple-500">
                              <div>
                                <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider opacity-90">
                                  <Sparkles size={14} className="text-yellow-300" />
                                  {notif.title}
                                </div>
                                <p className="text-sm font-medium leading-snug opacity-95 whitespace-pre-wrap">{notif.message}</p>
                              </div>
                              <button
                                onClick={() => markNotificationRead(notif.id)}
                                className="mt-4 text-xs bg-white/20 hover:bg-white/30 py-1.5 px-3 rounded-lg self-start transition-colors backdrop-blur-sm"
                              >
                                Marcar como leída
                              </button>
                            </div>
                          ))}

                          {alerts.map((alert, i) => (
                            <div key={i} className={'snap-center min-w-[280px] p-5 rounded-2xl shadow-sm border flex flex-col justify-between ' + (alert.type === 'alert' ? 'bg-[#C7958E] text-white border-[#C7958E]' : 'bg-[#9ECCB4] text-white border-[#9ECCB4]')}>
                              <div>
                                <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider opacity-90">
                                  {alert.type === 'alert' ? <AlertCircle size={14} /> : <Star size={14} />}
                                  {alert.title}
                                </div>
                                <p className="text-sm font-medium leading-snug opacity-95">{alert.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white p-6 rounded-2xl border border-dashed border-stone-200 text-center text-stone-400 text-xs italic">
                          Todo se ve tranquilo por aquí. ¡Sigue así!
                        </div>
                      )}
                    </div>

                    {/* LAST LOG */}
                    {logs.length > 0 && (
                      <div>
                        <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Último Registro</h3>
                        <LogHistoryItem log={logs[0]} />
                      </div>
                    )}

                    {/* QUICK ACCESS */}
                    <div>
                      <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Acceso Rápido</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => {
                            const hasF0 = submittedForms.some(f => f.form_type === 'F0');
                            if (!hasF0) {
                              showNotif('Debes completar el F0 antes de registrar datos diarios', 'error');
                              setView('CONSULTATIONS');
                            } else {
                              setView('TRACKER');
                            }
                          }}
                          className="bg-white p-4 rounded-2xl shadow-sm border border-[#F4F0ED] flex items-center gap-4 hover:border-[#C7958E] transition-colors group text-left"
                        >
                          <div className="bg-[#C7958E]/10 p-3 rounded-full text-[#C7958E] group-hover:bg-[#C7958E] group-hover:text-white transition-colors"><Plus size={24} /></div>
                          <div>
                            <span className="block text-sm font-bold text-[#4A4A4A]">Registrar Diario</span>
                            <span className="text-[10px] text-[#5D7180]">Añadir datos hoy</span>
                          </div>
                        </button>
                        <button onClick={() => setView('EDUCATION')} className="bg-white p-4 rounded-2xl shadow-sm border border-[#F4F0ED] flex items-center gap-4 hover:border-[#C7958E] transition-colors group text-left">
                          <div className="bg-[#95706B]/10 p-3 rounded-full text-[#95706B] group-hover:bg-[#95706B] group-hover:text-white transition-colors"><BookOpen size={24} /></div>
                          <div>
                            <span className="block text-sm font-bold text-[#4A4A4A]">Ver Módulos</span>
                            <span className="text-[10px] text-[#5D7180]">Continuar curso</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {view === 'TRACKER' && <TrackerView />}
          {view === 'EDUCATION' && <EducationView />}
          {view === 'CONSULTATIONS' && <ConsultationsView />}

          {view === 'PROFILE' && (
            <div className="pb-24">
              {/* TAB SELECTOR */}
              <div className="flex gap-2 mb-6 bg-white p-1 rounded-2xl shadow-sm">
                <button
                  onClick={() => setProfileTab('PROFILE')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${profileTab === 'PROFILE'
                    ? 'bg-[#C7958E] text-white shadow-md'
                    : 'text-[#5D7180] hover:bg-[#F4F0ED]'
                    }`}
                >
                  Mi Perfil
                </button>
                <button
                  onClick={() => setProfileTab('HISTORIA')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${profileTab === 'HISTORIA'
                    ? 'bg-[#C7958E] text-white shadow-md'
                    : 'text-[#5D7180] hover:bg-[#F4F0ED]'
                    }`}
                >
                  Historia
                </button>
              </div>

              {/* PROFILE TAB */}
              {profileTab === 'PROFILE' && (
                <div className="space-y-6">
                  {/* FERTY SCORE & 4 PILLARS (REMOVED from Profile, moved to Dashboard) */}
                  {/* Replaced with Document Style Profile Info */}
                  {/* Replaced with Document Style Profile Info - PERSONAL DATA ONLY */}
                  <div className="space-y-4">
                    {/* HEADER - DISCRETE STYLE */}
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <h3 className="font-bold text-[#4A4A4A] text-sm">Datos Personales</h3>
                        <p className="text-[10px] text-[#5D7180] mt-0.5">
                          Miembro desde: {new Date(user.joinedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (isEditingProfile) handleSaveProfile();
                          else setIsEditingProfile(true);
                        }}
                        className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                      >
                        {isEditingProfile ? <Check size={16} /> : <Edit2 size={16} />}
                      </button>
                    </div>

                    {/* PROFILE DATA LIST */}
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
                      <div className="pb-1">
                        <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Estado (Pareja)</p>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={editPartnerStatus}
                            onChange={e => setEditPartnerStatus(e.target.value)}
                            className="w-full text-sm text-[#4A4A4A] border-b border-[#C7958E] focus:outline-none py-1"
                            placeholder="Ej: Soltera, En pareja..."
                          />
                        ) : (
                          <p className="text-sm text-[#4A4A4A]">{user.partnerStatus || 'No especificado'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* NOTIFICACIONES-Últimas 3 */}
                  <div>
                    <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Notificaciones Recientes</h3>
                    {visibleNotifications.slice(0, 3).length > 0 ? (
                      <div className="space-y-3">
                        {visibleNotifications.slice(0, 3).map(notif => (
                          <NotificationCard key={notif.id} notification={notif} onMarkRead={markNotificationRead} deleteNotification={deleteNotification} />
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white p-6 rounded-2xl border border-dashed border-stone-200 text-center text-stone-400 text-xs italic">
                        No tienes notificaciones recientes
                      </div>
                    )}
                  </div>

                  {/* INFORMES-Todos */}
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

                  {/* REINICIAR MÉTODO */}
                  {user.methodStartDate && (
                    <button
                      onClick={async () => {
                        if (confirm('¿Estás seguro de que quieres reiniciar el método? Esto borrará tu fecha de inicio actual.')) {
                          const { error } = await supabase.from('profiles').update({ method_start_date: null }).eq('id', user.id);
                          if (!error) {
                            setUser({ ...user, methodStartDate: null });
                            showNotif('Método reiniciado correctamente', 'success');
                          }
                        }
                      }}
                      className="w-full py-2 text-xs text-stone-400 hover:text-[#C7958E] transition-colors underline"
                    >
                      Reiniciar Método
                    </button>
                  )}

                  {/* LOGOUT */}
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setUser(null);
                      setView('ONBOARDING');
                    }}
                    className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors border border-rose-100"
                  >
                    <LogOut size={20} />
                    Cerrar Sesión
                  </button>
                </div>
              )}

              {/* HISTORIA TAB */}
              {profileTab === 'HISTORIA' && (() => {
                const f0Form = submittedForms.find(f => f.form_type === 'F0');

                if (!f0Form) {
                  return (
                    <div className="bg-white p-8 rounded-2xl border border-dashed border-stone-200 text-center">
                      <FileText size={48} className="mx-auto text-stone-300 mb-4" />
                      <p className="text-stone-400 text-sm">
                        Aún no has completado el formulario F0
                      </p>
                      <button
                        onClick={() => setView('CONSULTATIONS')}
                        className="mt-4 bg-[#C7958E] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#95706B] transition-colors"
                      >
                        Completar F0
                      </button>
                    </div>
                  );
                }

                const formatDate = (dateStr: string) => {
                  const date = new Date(dateStr);
                  return date.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });
                };

                return (
                  <div className="space-y-4">
                    {/* DISCRETE HEADER - Same style as "Datos Personales" */}
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <h3 className="font-bold text-[#4A4A4A] text-sm">Ficha Personal (F0)</h3>
                        <p className="text-[10px] text-[#5D7180] mt-0.5">
                          Registrado: {formatDate(f0Form.submitted_at || new Date().toISOString())}
                        </p>
                        {f0Form.pdf_generated_at && (
                          <p className="text-[10px] text-[#5D7180] mt-0.5">
                            Última actualización: {formatDate(f0Form.pdf_generated_at)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setView('CONSULTATIONS')}
                        className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>

                    {/* FERTY SCORE BADGE - Exact design from screenshot */}
                    {(() => {
                      const scores = calculateFertyScore(user, logs);
                      return (
                        <div className="bg-gradient-to-br from-[#C7958E]/30 to-[#95706B]/30 backdrop-blur-sm rounded-2xl p-6 border border-[#C7958E]/20">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-[#95706B] mb-2">Ferty Score</p>
                              <p className="text-5xl font-bold text-[#4A4A4A]">{scores.total}<span className="text-2xl text-[#5D7180]">/100</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold uppercase tracking-wider text-[#95706B] mb-2">Pilares</p>
                              <div className="flex gap-4 text-xs">
                                <div className="flex flex-col items-center">
                                  <span className="font-bold text-3xl text-[#4A4A4A]">{scores.function}</span>
                                  <span className="text-[#5D7180] uppercase text-[10px]">Func</span>
                                </div>
                                <div className="w-px h-12 bg-[#C7958E]/30"></div>
                                <div className="flex flex-col items-center">
                                  <span className="font-bold text-3xl text-[#4A4A4A]">{scores.food}</span>
                                  <span className="text-[#5D7180] uppercase text-[10px]">Food</span>
                                </div>
                                <div className="w-px h-12 bg-[#C7958E]/30"></div>
                                <div className="flex flex-col items-center">
                                  <span className="font-bold text-3xl text-[#4A4A4A]">{scores.flora}</span>
                                  <span className="text-[#5D7180] uppercase text-[10px]">Flora</span>
                                </div>
                                <div className="w-px h-12 bg-[#C7958E]/30"></div>
                                <div className="flex flex-col items-center">
                                  <span className="font-bold text-3xl text-[#4A4A4A]">{scores.flow}</span>
                                  <span className="text-[#5D7180] uppercase text-[10px]">Flow</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* F0 DATA */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F4F0ED] space-y-4">
                      {f0Form.answers.map((answer, idx) => {
                        // Find question text from FORM_DEFINITIONS
                        const question = FORM_DEFINITIONS.F0.questions.find(q => q.id === answer.questionId);
                        if (!question) return null;

                        let displayValue = answer.answer;

                        // Format dates
                        if (question.type === 'date' && typeof displayValue === 'string') {
                          displayValue = formatDate(displayValue);
                        }

                        // Format arrays
                        if (Array.isArray(displayValue)) {
                          displayValue = displayValue.join(', ');
                        }

                        return (
                          <div key={idx} className="border-b border-[#F4F0ED] pb-3 last:border-0">
                            <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">
                              {question.text}
                            </p>
                            <p className="text-sm text-[#4A4A4A]">
                              {displayValue || '-'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
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