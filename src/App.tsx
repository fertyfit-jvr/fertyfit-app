
import React, { Component, useState, useEffect, ErrorInfo, ReactNode } from 'react';
import {
  Heart, Activity, BookOpen, FileText, User, LogOut, AlertCircle,
  Moon, Sun, PlayCircle, FileText as PdfIcon,
  Lock, Database, Copy, X, Star, Award, Mail, Key, CheckSquare, Download, ChevronDown, ChevronUp, Settings, ArrowRight, Smile, Play,
  CheckCircle, WineOff, Calendar, Stethoscope, Thermometer, Droplets, Zap, Clock, Scale, Square, CheckSquare as CheckSquareIcon, Plus, Minus
} from 'lucide-react';

import { UserProfile, DailyLog, ViewState, CourseModule, MucusType, AdminReport, DailyLog as DailyLogType, ConsultationForm, LHResult, Lesson } from './types';
import { SYMPTOM_OPTIONS, MUCUS_OPTIONS, CERVIX_HEIGHT_OPTIONS, CERVIX_FIRM_OPTIONS, CERVIX_OPEN_OPTIONS, BRAND_ASSETS, LH_OPTIONS } from './constants';
import { calculateAverages, calculateAlcoholFreeStreak, getLastLogDetails, formatDateForDB, calculateBMI, calculateVitalityStats, getBMIStatus, calculateDaysOnMethod, calculateCurrentWeek } from './services/dataService';
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

// --- SQL Script ---
const SQL_SETUP_SCRIPT = `
-- SCRIPT MAESTRO V23: CLEAN START

-- 1. LIMPIEZA DE DATOS DE USUARIO (Reset)
TRUNCATE TABLE public.daily_logs CASCADE;
TRUNCATE TABLE public.consultation_forms CASCADE;
TRUNCATE TABLE public.user_progress CASCADE;
TRUNCATE TABLE public.admin_reports CASCADE;

-- Limpiar perfil pero mantener cuenta
UPDATE public.profiles 
SET weight = NULL, height = NULL, main_objective = NULL, method_start_date = NULL, 
    partner_status = NULL, cycle_length = NULL, last_period_date = NULL, diagnoses = NULL;

-- 2. LIMPIEZA DE CONTENIDO
DELETE FROM public.content_lessons;
DELETE FROM public.content_modules;

-- 3. ACTUALIZACIÓN DE ESTRUCTURA (Schema)
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists method_start_date timestamp with time zone;
alter table public.profiles add column if not exists main_objective text;

alter table public.daily_logs add column if not exists cervix_height text;
alter table public.daily_logs add column if not exists cervix_firmness text;
alter table public.daily_logs add column if not exists cervix_openness text;
alter table public.daily_logs alter column date type date using date::date;

alter table public.content_modules add column if not exists phase int default 1;
alter table public.content_lessons add column if not exists description text;

-- 4. CREAR MÓDULOS (12 Semanas)
INSERT INTO public.content_modules (id, title, description, order_index, phase) VALUES
(0, 'Bienvenida: El Inicio', 'Lo que necesitas saber antes de empezar.', 0, 0),
(1, 'Semana 1: Punto de Partida', 'Conciencia y registro de biomarcadores.', 1, 1),
(2, 'Semana 2: Ciclo y Ventana Fértil', 'Identificación de tu patrón ovulatorio.', 2, 1),
(3, 'Semana 3: Detox y Entorno', 'Eliminando disruptores (BPA, Ftalatos).', 3, 1),
(4, 'Semana 4: Nutrición Base', 'Suplementos iniciales y alimentación.', 4, 1),
(5, 'Semana 5: Analíticas Hormonales', 'Interpretando AMH, FSH, TSH.', 5, 2),
(6, 'Semana 6: Nutrición Aplicada', 'Ajuste por fase del ciclo.', 6, 2),
(7, 'Semana 7: Microbiota', 'Restauración intestinal y vaginal.', 7, 2),
(8, 'Semana 8: Manejo del Estrés', 'Plan de bienestar emocional.', 8, 2),
(9, 'Semana 9: Carpeta Pre-Consulta', 'Organización y plan de acción.', 9, 3),
(10, 'Semana 10: Preparación Emocional', 'Relato clínico (3 minutos).', 10, 3),
(11, 'Semana 11: Decisión de Ruta', 'Natural vs Reproducción Asistida.', 11, 3),
(12, 'Semana 12: Integración', 'Plan Maestro a 60 días.', 12, 3);

SELECT setval('content_modules_id_seq', (SELECT MAX(id) FROM content_modules));

-- 5. CREAR LECCIONES
-- Usamos Lofi Girl (Safe Embed) ID: 5qap5aO4i9A
INSERT INTO public.content_lessons (module_id, title, duration, type, content_url, description)
SELECT id, 'Masterclass: ' || title, '15 min', 'video', 'https://www.youtube.com/embed/5qap5aO4i9A', 
'En esta lección fundamental exploraremos los conceptos clave de la semana. Aprenderás las bases fisiológicas y prácticas para aplicar el método FertyFit en tu día a día.'
FROM public.content_modules;

INSERT INTO public.content_lessons (module_id, title, duration, type, content_url, description)
SELECT id, 'Guía de Trabajo: ' || title, 'Lectura', 'pdf', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
'Descarga tu cuaderno de trabajo semanal. Incluye checklist de hábitos, recetas recomendadas para esta fase y ejercicios de reflexión.'
FROM public.content_modules;

-- 6. RECARGA DE CACHÉ
NOTIFY pgrst, 'reload schema';
`;

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
  let id = '';
  // Clean URL first
  if (url.includes('youtu.be/')) {
    id = url.split('youtu.be/')[1]?.split('?')[0];
  } else if (url.includes('watch?v=')) {
    id = url.split('v=')[1]?.split('&')[0];
  } else if (url.includes('embed/')) {
    id = url.split('embed/')[1]?.split('?')[0];
  }

  return id ? `https://www.youtube.com/embed/${id}` : url;
};

const FORM_DEFINITIONS = {
  F0: {
    title: "F0: Ficha Personal Inicial",
    description: "Esta información es la base de tu protocolo personalizado.",
    questions: [
      { id: 'q1_age', text: "Tu edad actual:", type: 'number' },
      { id: 'q2_height', text: "Altura (cm):", type: 'number' },
      { id: 'q2_weight', text: "Peso (kg):", type: 'number' },
      { id: 'q3_time_trying', text: "Tiempo buscando embarazo (Meses):", type: 'number' },
      { id: 'q4_objective', text: "Objetivo principal:", type: 'select', options: ['Concepción natural', 'Reproducción Asistida'] },
      { id: 'q5_partner', text: "¿Buscas en pareja o solitario?", type: 'select', options: ['Pareja', 'Solitario'] },
      { id: 'q6_cycle', text: "Duración ciclo promedio (Días):", type: 'number' },
      { id: 'q7_regularity', text: "¿Ciclos regulares?", type: 'select', options: ['Regulares', 'Irregulares'] },
      { id: 'q8_last_period', text: "Fecha última regla:", type: 'date' },
      { id: 'q9_diagnoses', text: "Diagnósticos relevantes (SOP, Endo, etc):", type: 'textarea' },
      { id: 'q13_supplements', text: "¿Tomas suplementos actualmente?", type: 'textarea' },
      { id: 'q15_stress', text: "Nivel de Estrés (1-5):", type: 'number' },
      { id: 'q16_sleep', text: "Horas de sueño promedio:", type: 'number' }
    ]
  },
  F1: {
    title: "F1: Punto de Partida (Semana 4)",
    questions: [
      { id: 'q1_confirm_tracker', text: "Confirma que has completado el registro de biomarcadores (30 días).", type: 'yesno' },
      { id: 'q2_cycle_length', text: "¿Cuál es la duración promedio de tu ciclo (en días)?", type: 'number' },
      { id: 'q3_immediate_changes', text: "¿Has implementado los 3 cambios inmediatos (sueño, caminar, sin azúcar)?", type: 'yesno' },
      { id: 'q4_supplements', text: "Suplementos iniciados y dosis:", type: 'text' },
      { id: 'q5_detox', text: "¿Has realizado la Auditoría de hogar (Detox)?", type: 'yesno' },
      { id: 'q6_symptoms', text: "Describe síntomas nuevos o cambios importantes:", type: 'textarea' },
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
      { id: 'q7_male', text: "Resumen Seminograma Pareja:", type: 'textarea' },
      { id: 'q8_microbiota', text: "Resumen Test Microbiota (si aplica):", type: 'textarea' },
      { id: 'q9_nutrition', text: "% Adherencia Nutricional estimada (0-100):", type: 'number' },
      { id: 'q10_supp_adj', text: "¿Ajustaste suplementación tras analíticas?", type: 'yesno' },
      { id: 'q11_emotional', text: "Práctica emocional y frecuencia:", type: 'text' },
      { id: 'q12_changes', text: "¿Cambios en bienestar tras protocolos?", type: 'textarea' },
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
      { id: 'q8_testimonial', text: "Testimonio / Feedback (Opcional):", type: 'textarea' }
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

const PhaseIntroModal = ({ phase, onClose, userId }: { phase: number, onClose: () => void, userId?: string }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const content = [
    { t: 'Bienvenida', d: 'Antes de empezar, configura tu perfil y revisa la introducción.', tasks: ['Rellenar F0', 'Ver Video Bienvenida', 'Iniciar Método'] },
    { t: 'Fase 1: Despertar', d: 'Semanas 1-4. Nos enfocamos en la conciencia corporal y registro.', tasks: ['Registro Diario', 'Detox de Hogar', 'Suplementación Base'] },
    { t: 'Fase 2: Reequilibrio', d: 'Semanas 5-8. Ajustes profundos en nutrición y manejo de estrés.', tasks: ['Analíticas Hormonales', 'Protocolo Microbiota', 'Mindset Fértil'] },
    { t: 'Fase 3: Impulso', d: 'Semanas 9-12. Preparación final y decisión de ruta.', tasks: ['Plan Maestro', 'Relato Clínico', 'Consulta F3'] }
  ];
  const info = content[phase] || content[0];

  const handleClose = () => {
    if (dontShowAgain && userId) {
      localStorage.setItem(`fertyfit_phase_seen_${userId}_${phase}`, 'true');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2rem] max-w-sm w-full p-8 shadow-2xl relative overflow-hidden border-4 border-white">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F4F0ED] to-white -z-10"></div>
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm hover:scale-110 transition-transform"><X size={20} className="text-[#95706B]" /></button>

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

        <div className="flex items-center justify-center gap-2 mb-6 cursor-pointer" onClick={() => setDontShowAgain(!dontShowAgain)}>
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${dontShowAgain ? 'bg-[#C7958E] border-[#C7958E]' : 'border-[#5D7180]'}`}>
            {dontShowAgain && <CheckSquareIcon size={14} className="text-white" />}
          </div>
          <span className="text-xs text-[#5D7180]">No volver a mostrar más</span>
        </div>

        <button onClick={handleClose} className="w-full bg-[#4A4A4A] text-white py-4 rounded-xl font-bold shadow-xl hover:scale-[1.02] transition-transform">
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

const ProfileHeader = ({ user, logsCount }: { user: UserProfile, logsCount: number }) => {
  // CRITICAL FIX: Use shared math function to ensure "Day 1" consistency
  const daysActive = calculateDaysOnMethod(user.methodStartDate);
  const level = logsCount > 30 ? "Experta" : (logsCount > 7 ? "Comprometida" : "Iniciada");
  // CRITICAL FIX: Use shared math function for weeks
  const currentWeek = calculateCurrentWeek(daysActive);

  return (
    <div className="bg-gradient-to-br from-[#C7958E] to-[#95706B] pt-10 pb-8 px-6 rounded-b-[2.5rem] shadow-lg mb-6 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      <div className="relative z-10 flex items-center gap-5 mb-6">
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
      <div className="relative z-10 flex justify-between bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
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
  );
};

// --- SUB-VIEWS EXTRACTED ---

const DisclaimerView = ({ onAccept }: { onAccept: () => void }) => (
  <div className="p-6 bg-white min-h-screen flex flex-col items-center justify-center">
    <div className="bg-[#F4F0ED] p-8 rounded-3xl border border-[#C7958E]/20 max-w-sm w-full shadow-xl">
      <h3 className="font-bold text-[#95706B] mb-4 flex items-center gap-2 text-lg"><AlertCircle size={24} /> Aviso Importante</h3>
      <p className="text-sm text-[#5D7180] leading-relaxed text-justify mb-6">
        FertyFit es un programa educativo. La información aquí presentada no sustituye el consejo médico profesional, diagnóstico o tratamiento.
        Al continuar, aceptas que eres responsable de tu salud y consultarás con tu médico cualquier cambio.
      </p>
      <button onClick={onAccept} className="w-full bg-[#C7958E] text-white py-4 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-[#95706B] transition-colors">
        Acepto y Continuar
      </button>
    </div>
  </div>
);

// UI CONTROLS FOR TRACKER
const Stepper = ({ value, onChange, min, max }: any) => (
  <div className="flex items-center justify-between bg-[#F4F0ED] rounded-xl p-2 w-full">
    <button onClick={() => onChange(Math.max(min, value - 1))} className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-[#95706B] active:scale-95 transition-transform"><Minus size={18} /></button>
    <span className="font-bold text-xl text-[#4A4A4A]">{value}</span>
    <button onClick={() => onChange(Math.min(max, value + 1))} className="w-10 h-10 bg-[#C7958E] text-white rounded-lg flex items-center justify-center shadow-sm active:scale-95 transition-transform"><Plus size={18} /></button>
  </div>
);

const SliderControl = ({ value, onChange, min, max, step, label, unit }: any) => (
  <div className="w-full">
    <div className="flex justify-between mb-2">
      <span className="text-xs font-bold text-[#5D7180] uppercase tracking-wider">{label}</span>
      <span className="text-xs font-bold text-[#C7958E]">{value}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step || 1}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-[#F4F0ED] rounded-lg appearance-none cursor-pointer accent-[#C7958E]"
    />
  </div>
);

const StressControl = ({ value, onChange }: any) => (
  <div className="w-full">
    <span className="block text-xs font-bold text-[#5D7180] uppercase tracking-wider mb-2">Nivel de Estrés</span>
    <div className="flex justify-between gap-2">
      {[1, 2, 3, 4, 5].map(num => {
        const emojis = ['😫', '😕', '😐', '🙂', '🤩'];
        const colors = ['bg-rose-400', 'bg-orange-300', 'bg-yellow-200', 'bg-emerald-200', 'bg-emerald-400'];
        const selected = value === num;
        return (
          <button
            key={num}
            onClick={() => onChange(num)}
            className={`h-12 flex-1 rounded-lg font-bold transition-all text-xl shadow-sm flex items-center justify-center ${colors[num - 1]} ${selected ? 'scale-110 ring-2 ring-offset-1 ring-[#95706B]' : 'opacity-60 hover:opacity-100'}`}
          >
            {emojis[num - 1]}
          </button>
        )
      })}
    </div>
  </div>
);

// --- BUFFERED INPUT COMPONENT ---
// Solves the "focus jumping" issue by isolating input state.
const BufferedInput = ({ value, onSave, type = "text", label, placeholder, icon: Icon }: any) => {
  const [localVal, setLocalVal] = useState(value || '');

  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const handleBlur = () => {
    if (localVal !== value) {
      onSave(localVal);
    }
  };

  return (
    <div className="mb-4">
      {label && <label className="block text-xs font-bold text-[#5D7180] uppercase tracking-wider mb-1">{label}</label>}
      <div className="relative">
        <input
          type={type}
          inputMode="decimal"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full p-3 bg-[#F4F0ED] rounded-xl text-[#4A4A4A] font-bold text-center outline-none focus:ring-2 focus:ring-[#C7958E]"
        />
        {Icon && <Icon className="absolute right-3 top-3 text-stone-400" size={16} />}
      </div>
    </div>
  );
};

const TrackerView = ({ logData, onSave, onChangeDate, logs }: { logData: Partial<DailyLog>, onSave: (data: Partial<DailyLog>) => void, onChangeDate: (date: string) => void, logs: DailyLog[] }) => {
  const updateField = (key: string, value: any) => {
    // Immediately update parent state or buffer in parent
    onSave({ ...logData, [key]: value });
  };

  return (
    <div className="pb-24 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#4A4A4A]">Registro Diario</h2>
        <input
          type="date"
          value={logData.date || ''}
          onChange={(e) => onChangeDate(e.target.value)}
          className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-[#5D7180] shadow-sm font-medium outline-none focus:ring-2 focus:ring-[#C7958E]"
        />
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-[#F4F0ED] space-y-6">
        {/* Fisiología */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#95706B] uppercase tracking-widest border-b border-[#F4F0ED] pb-2">Fisiología</h3>
          <div className="grid grid-cols-2 gap-4">
            <BufferedInput
              label="Día Ciclo"
              value={logData.cycleDay}
              onSave={(val: string) => updateField('cycleDay', parseInt(val) || 1)}
            />
            <div className="mb-4">
              <label className="block text-xs font-bold text-[#5D7180] uppercase tracking-wider mb-1">Tº Basal</label>
              <div className="flex flex-col gap-2">
                <BufferedInput
                  value={logData.bbt}
                  onSave={(val: string) => updateField('bbt', parseFloat(val))}
                  placeholder="36.0"
                />
                <input
                  type="range"
                  min="35.5"
                  max="37.5"
                  step="0.1"
                  value={logData.bbt || 36.5}
                  onChange={e => updateField('bbt', parseFloat(e.target.value))}
                  className="w-full accent-[#C7958E] h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-[#5D7180] uppercase tracking-wider mb-1">Moco Cervical</label>
            <div className="flex flex-wrap gap-2">{MUCUS_OPTIONS.map(o => <button key={o} onClick={() => updateField('mucus', o)} className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${logData.mucus === o ? 'bg-[#C7958E] text-white border-[#C7958E]' : 'bg-white border-[#F4F0ED] text-[#5D7180] hover:border-[#C7958E]'}`}>{o}</button>)}</div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-[#5D7180] uppercase tracking-wider mb-1">Test LH</label>
            <div className="flex flex-wrap gap-2">
              {LH_OPTIONS.map(o => (
                <button key={o} onClick={() => updateField('lhTest', o)} className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${logData.lhTest === o ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-[#F4F0ED] text-[#5D7180] hover:border-indigo-200'}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#F4F0ED]/50 p-4 rounded-xl border border-[#F4F0ED]">
            <span className="text-xs font-bold text-[#5D7180] block mb-3 uppercase">Cérvix (Opcional)</span>
            <div className="grid grid-cols-3 gap-2">
              <select className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]" value={logData.cervixHeight} onChange={e => updateField('cervixHeight', e.target.value)}><option value="">Altura...</option>{CERVIX_HEIGHT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
              <select className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]" value={logData.cervixFirmness} onChange={e => updateField('cervixFirmness', e.target.value)}><option value="">Firmeza...</option>{CERVIX_FIRM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
              <select className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]" value={logData.cervixOpenness} onChange={e => updateField('cervixOpenness', e.target.value)}><option value="">Apertura...</option>{CERVIX_OPEN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
            </div>
          </div>

          <div className="flex items-center justify-between bg-rose-50/50 p-4 rounded-xl border border-rose-100/50">
            <span className="font-bold text-[#95706B] text-sm">Relaciones Sexuales</span>
            <button onClick={() => updateField('sex', !logData.sex)} className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${logData.sex ? 'bg-[#C7958E]' : 'bg-stone-200'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${logData.sex ? 'left-7' : 'left-1'}`}></div></button>
          </div>
        </div>

        {/* Estilo de Vida - VISUAL CONTROLS + BUFFERED INPUTS */}
        <div className="space-y-4 border-t border-[#F4F0ED] pt-6">
          <h3 className="text-xs font-bold text-[#95706B] uppercase tracking-widest">Hábitos & Bienestar</h3>

          <div className="grid grid-cols-1 gap-6">
            <SliderControl label="Sueño" value={logData.sleepHours || 0} onChange={(v: number) => updateField('sleepHours', v)} min={0} max={12} step={0.5} unit="h" />
            <StressControl value={logData.stressLevel || 1} onChange={(v: number) => updateField('stressLevel', v)} />
          </div>

          <div className="grid grid-cols-1 gap-6 mt-4">
            <SliderControl label="Actividad Física" value={logData.activityMinutes || 0} onChange={(v: number) => updateField('activityMinutes', v)} min={0} max={120} step={5} unit=" min" />
            <SliderControl label="Luz Solar" value={logData.sunMinutes || 0} onChange={(v: number) => updateField('sunMinutes', v)} min={0} max={60} step={5} unit=" min" />
          </div>

          <div className="flex items-center justify-between bg-white border border-[#F4F0ED] p-4 rounded-xl mt-4">
            <span className="font-bold text-[#5D7180] text-sm">Consumo de Alcohol</span>
            <button onClick={() => updateField('alcohol', !logData.alcohol)} className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${logData.alcohol ? 'bg-[#C7958E]' : 'bg-emerald-400'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${logData.alcohol ? 'left-7' : 'left-1'}`}></div></button>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="mb-4">
              <label className="block text-xs font-bold text-[#5D7180] uppercase tracking-wider mb-1 text-center">Agua (Vasos)</label>
              <Stepper value={logData.waterGlasses || 0} onChange={(v: number) => updateField('waterGlasses', v)} min={0} max={15} />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-[#5D7180] uppercase tracking-wider mb-1 text-center">Vegetales</label>
              <Stepper value={logData.veggieServings || 0} onChange={(v: number) => updateField('veggieServings', v)} min={0} max={10} />
            </div>
          </div>
        </div>

        <button onClick={() => onSave(logData)} className="w-full bg-[#4A4A4A] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition-colors mt-4">Guardar Registro Diario</button>
      </div>

      <div>
        <h3 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2 text-sm uppercase tracking-wider opacity-80">Historial Reciente</h3>
        <div className="space-y-2">
          {logs.slice(0, 7).map(log => <LogHistoryItem key={log.date} log={log} />)}
        </div>
      </div>
    </div>
  )
};

const EducationView = ({ courseModules, setActiveLesson }: { courseModules: CourseModule[], setActiveLesson: any }) => {
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
            <div className={`rounded-2xl p-1 flex items-center gap-4`}>
              <img src={phase.icon} alt="" className="w-12 h-12 rounded-full object-cover shadow-sm border-2 border-white" />
              <div>
                <h3 className="font-bold text-lg text-[#4A4A4A]">{phase.title}</h3>
                <p className="text-xs text-[#5D7180] uppercase font-medium tracking-wider">{phase.range}</p>
              </div>
            </div>
            <div className="space-y-3 pl-2">
              {phaseModules.map(mod => (
                <div key={mod.id} className={`relative bg-white border rounded-xl p-5 transition-all ${mod.isLocked ? 'opacity-60 grayscale' : 'shadow-[0_2px_15px_rgba(0,0,0,0.03)] border-[#F4F0ED]'}`}>
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
                            <div className={`p-1.5 rounded-full shadow-sm transition-transform group-hover:scale-110 ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-[#C7958E]'}`}>
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

const ConsultationsView = ({ user, submittedForms, logs, fetchUserForms, showNotif, onProfileUpdate }: any) => {
  const daysActive = calculateDaysOnMethod(user?.methodStartDate);
  const canAccessF1 = daysActive >= 30;
  const canAccessF2 = daysActive >= 60;
  const canAccessF3 = daysActive >= 90;
  const [formType, setFormType] = useState<'F0' | 'F1' | 'F2' | 'F3'>('F0');
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const isLocked = (formType === 'F1' && !canAccessF1) || (formType === 'F2' && !canAccessF2) || (formType === 'F3' && !canAccessF3);
  const definition = FORM_DEFINITIONS[formType];

  // Check if already submitted
  const submittedForm = submittedForms.find((f: any) => f.form_type === formType);

  const handleSubmit = async () => {
    if (!user?.id) return;
    const formattedAnswers = definition.questions.map(q => ({ questionId: q.id, question: q.text, answer: answers[q.id] || '' }));
    const { error } = await supabase.from('consultation_forms').insert({ user_id: user.id, form_type: formType, answers: formattedAnswers, status: 'pending', snapshot_stats: calculateAverages(logs) });
    if (!error) {
      // IF F0, UPDATE PROFILE SYNC IMMEDIATELY
      if (formType === 'F0') {
        const updates: any = {};
        if (answers['q2_weight']) updates.weight = parseFloat(answers['q2_weight']);
        if (answers['q2_height']) updates.height = parseFloat(answers['q2_height']);
        if (answers['q4_objective']) updates.main_objective = answers['q4_objective'];

        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', user.id);
          onProfileUpdate(updates); // Callback to update parent state
        }
      }
      showNotif("Formulario enviado correctamente.", 'success');
      setAnswers({});
      fetchUserForms(user.id);
    } else {
      showNotif(error.message, 'error');
    }
  };

  return (
    <div className="pb-24 space-y-6">
      <h2 className="text-xl font-bold text-[#4A4A4A]">Consultas</h2>
      <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-[#F4F0ED] overflow-x-auto">
        {[{ id: 'F0', l: 'F0 Base' }, { id: 'F1', l: 'F1 (30d)' }, { id: 'F2', l: 'F2 (60d)' }, { id: 'F3', l: 'F3 (90d)' }].map(t => (
          <button key={t.id} onClick={() => setFormType(t.id as any)} className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${formType === t.id ? 'bg-[#C7958E] text-white shadow-md' : 'text-[#5D7180] hover:bg-[#F4F0ED]'}`}>
            {t.l} {submittedForms.find((f: any) => f.form_type === t.id) && '✅'}
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
      ) : submittedForm ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
          <div className="flex justify-between items-center mb-4 border-b border-[#F4F0ED] pb-4">
            <h3 className="font-bold text-lg text-[#4A4A4A]">{definition.title}</h3>
            <span className="bg-emerald-100 text-emerald-600 text-[10px] px-3 py-1 rounded-full font-bold border border-emerald-200 flex items-center gap-1"><CheckCircle size={10} /> ENVIADO</span>
          </div>
          <div className="space-y-4 opacity-80">
            {(submittedForm.answers as any[]).map((ans: any) => (
              <div key={ans.questionId} className="bg-[#F4F0ED]/30 p-3 rounded-xl">
                <p className="text-[10px] uppercase font-bold text-[#95706B] mb-1">{ans.question}</p>
                <p className={`text-sm font-medium ${!ans.answer ? 'text-stone-400 italic' : 'text-[#4A4A4A]'}`}>
                  {Array.isArray(ans.answer) ? ans.answer.join(', ') : (ans.answer || "Sin respuesta")}
                </p>
              </div>
            ))}
          </div>
          {submittedForm.status === 'pending' && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3">
              <div className="bg-yellow-100 p-2 rounded-full text-yellow-600"><Stethoscope size={16} /></div>
              <div>
                <p className="text-xs font-bold text-yellow-800">En Revisión por Especialista</p>
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
      ) : (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
          <h3 className="font-bold text-lg text-[#C7958E] mb-1">{definition.title}</h3>
          {/* @ts-ignore */}
          <p className="text-xs text-[#5D7180] mb-6 border-b border-[#F4F0ED] pb-4">{definition.description || "Rellena los datos para tu evaluación."}</p>
          <div className="space-y-6">
            {definition.questions.map(q => (
              <div key={q.id}>
                <label className="block text-xs font-bold text-[#4A4A4A] mb-2 uppercase tracking-wide">{q.text}</label>
                {q.type === 'textarea' ? (
                  <textarea className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm h-28 bg-[#F4F0ED]/30 focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E] outline-none transition-all" onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />
                ) : q.type === 'yesno' ? (
                  <div className="flex gap-3">
                    <button onClick={() => setAnswers({ ...answers, [q.id]: 'Sí' })} className={`flex-1 py-3 text-sm border rounded-xl transition-all font-bold ${answers[q.id] === 'Sí' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'border-[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]'}`}>Sí</button>
                    <button onClick={() => setAnswers({ ...answers, [q.id]: 'No' })} className={`flex-1 py-3 text-sm border rounded-xl transition-all font-bold ${answers[q.id] === 'No' ? 'bg-rose-50 border-rose-400 text-rose-500' : 'border-[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]'}`}>No</button>
                  </div>
                ) : q.type === 'select' ? (
                  <select className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-white text-[#5D7180] outline-none focus:ring-2 focus:ring-[#C7958E]/20" onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {q.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'} className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-[#F4F0ED]/30 focus:border-[#C7958E] outline-none transition-all" onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />
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

const SpecialistView = ({ pendingForms, approveForm }: any) => {
  return (
    <div className="pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#4A4A4A]">Panel Especialista</h2>
        <span className="bg-emerald-100 text-emerald-600 text-xs px-3 py-1 rounded-full font-bold">Admin Mode</span>
      </div>

      <div className="space-y-4">
        {pendingForms.length === 0 ? (
          <div className="text-center py-12 text-[#5D7180] bg-white rounded-3xl border border-[#F4F0ED]">
            <CheckCircle className="mx-auto mb-2 text-[#C7958E]" size={32} />
            <p className="text-sm">No hay formularios pendientes.</p>
          </div>
        ) : (
          pendingForms.map((form: any) => (
            <div key={form.id} className="bg-white p-5 rounded-2xl shadow-sm border border-[#F4F0ED]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="bg-[#4A4A4A] text-white text-[10px] px-2 py-1 rounded font-bold">{form.form_type}</span>
                  <p className="text-xs text-[#5D7180] mt-1">User: {form.user_id?.substring(0, 8)}...</p>
                </div>
                <span className="text-[10px] bg-orange-100 text-orange-500 px-2 py-1 rounded-full font-bold">Pendiente</span>
              </div>
              <div className="bg-[#F4F0ED]/50 p-3 rounded-lg text-xs text-[#5D7180] mb-4 max-h-32 overflow-y-auto custom-scrollbar">
                <pre className="whitespace-pre-wrap font-sans">{JSON.stringify(form.answers, null, 2)}</pre>
              </div>
              <button
                onClick={() => approveForm(form.id!, form.user_id!)}
                className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <CheckSquare size={14} /> Aprobar y Subir Reporte (Simulado)
              </button>
            </div>
          ))
        )}
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
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [dbMissing, setDbMissing] = useState(false);
  const [specialistMode, setSpecialistMode] = useState(false); // Toggle for Admin view
  const [pendingForms, setPendingForms] = useState<ConsultationForm[]>([]);
  const [submittedForms, setSubmittedForms] = useState<ConsultationForm[]>([]);
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

  useEffect(() => { checkUser(); }, []);

  // REFRESH REPORTS WHEN ENTERING PROFILE
  useEffect(() => {
    if (view === 'PROFILE' && user?.id) {
      fetchReports(user.id);
    }
  }, [view, user?.id]);

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

        if (error && error.code === '42P01') { setDbMissing(true); setLoading(false); return; }

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
            if (createError.code === '42P01') setDbMissing(true);
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

          // Fetch data
          await fetchLogs(session.user.id);
          await fetchEducation(session.user.id, profile.method_start_date);
          await fetchReports(session.user.id);
          await fetchUserForms(session.user.id);

          // Determine phase
          let phase = 0;
          if (profile.method_start_date) {
            const days = Math.floor((new Date().getTime() - new Date(profile.method_start_date).getTime()) / (1000 * 3600 * 24));
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

          if (!profile.disclaimer_accepted) setView('DISCLAIMER');
          else setView('DASHBOARD');
        }
      } else {
        setView('ONBOARDING');
      }
    } catch (err) { console.error(err); setView('ONBOARDING'); } finally { setLoading(false); }
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
    setReports([]);
    setView('ONBOARDING');
  };

  const fetchLogs = async (userId: string) => {
    const { data } = await supabase.from('daily_logs').select('*').eq('user_id', userId).order('date', { ascending: false });
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

  const fetchReports = async (userId: string) => {
    const { data } = await supabase.from('admin_reports').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setReports(data);
  };

  const fetchUserForms = async (userId: string) => {
    const { data } = await supabase.from('consultation_forms').select('*').eq('user_id', userId);
    if (data) setSubmittedForms(data);
  };

  const fetchEducation = async (userId: string, methodStart?: string) => {
    const { data: modulesData } = await supabase.from('content_modules').select(`*, content_lessons (*)`).order('order_index');
    const { data: progressData } = await supabase.from('user_progress').select('lesson_id').eq('user_id', userId);
    const completedSet = new Set(progressData?.map(p => p.lesson_id) || []);

    let currentWeek = 0;
    if (methodStart) {
      const days = Math.floor((new Date().getTime() - new Date(methodStart).getTime()) / (1000 * 3600 * 24));
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

  const saveDailyLog = async (logToSave?: Partial<DailyLog>) => {
    const data = logToSave || todayLog;
    if (!user?.id) return;
    if (!data.date) { showNotif("La fecha es obligatoria", 'error'); return; }
    const validDate = formatDateForDB(data.date);
    const formattedLog = { ...data, date: validDate };

    const { error } = await supabase.from('daily_logs').upsert(mapLogToDB(formattedLog as DailyLog, user.id), { onConflict: 'user_id, date' });
    if (!error) {
      showNotif("Registro guardado con éxito", 'success');
      await fetchLogs(user.id);
      setView('DASHBOARD');
    } else {
      showNotif("Error al guardar: " + error.message, 'error');
    }
  };

  const startMethod = async () => {
    if (!user?.id) return;
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

  // --- SPECIALIST / ADMIN LOGIC ---
  const fetchPendingForms = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('consultation_forms').select('*').eq('status', 'pending');
    if (data) setPendingForms(data);
  };

  const approveForm = async (formId: number, userId: string) => {
    await supabase.from('consultation_forms').update({ status: 'reviewed' }).eq('id', formId);
    const reportTitle = "Informe Médico - " + new Date().toLocaleDateString();
    await supabase.from('admin_reports').insert({ user_id: userId, title: reportTitle, report_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' });
    showNotif("Formulario aprobado y reporte enviado.", 'success');
    fetchPendingForms();
  };

  const handleModalClose = () => {
    if (user?.id) {
      localStorage.setItem(`fertyfit_phase_seen_${user.id}_${currentPhase}`, 'true');
    }
    setShowPhaseModal(false);
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
                    src={`${getEmbedUrl(activeLesson.content_url)}?origin=${window.location.origin}&rel=0`}
                    title={activeLesson.title}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
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

  if (dbMissing) {
    return (
      <div className="min-h-screen bg-[#4A4A4A] p-8 text-white flex flex-col items-center justify-center">
        <Database size={48} className="text-[#C7958E] mb-4" />
        <h1 className="text-2xl font-bold mb-4">Actualización de Sistema</h1>
        <p className="text-stone-400 text-center mb-6 text-sm">Hemos mejorado la base de datos. Por favor, ejecuta este script.</p>
        <div className="bg-black/50 p-4 rounded-xl text-[10px] font-mono text-emerald-400 w-full h-64 overflow-auto mb-4 border border-stone-600 select-all custom-scrollbar">
          {SQL_SETUP_SCRIPT}
        </div>
        <button onClick={() => navigator.clipboard.writeText(SQL_SETUP_SCRIPT)} className="bg-white text-[#4A4A4A] px-6 py-3 rounded-full font-bold mb-2 flex items-center gap-2 hover:bg-stone-200 transition-colors"><Copy size={16} /> Copiar Código SQL</button>
        <button onClick={() => window.location.reload()} className="mt-8 text-stone-400 underline hover:text-white text-sm">Ya lo he ejecutado, volver.</button>
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

        <button onClick={() => setDbMissing(true)} className="w-full mt-8 text-[10px] text-stone-300 hover:text-stone-400 flex items-center justify-center gap-1">
          <Settings size={10} />
        </button>
      </div>
    </div>
  );

  if (view === 'DISCLAIMER') {
    return <DisclaimerView onAccept={acceptDisclaimer} />;
  }

  // --- DASHBOARD & MAIN VIEW ---

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#F4F0ED] relative font-sans text-[#4A4A4A] pb-24">
      {showPhaseModal && <PhaseIntroModal phase={currentPhase} onClose={handleModalClose} userId={user?.id} />}
      {notif && <Notification message={notif.msg} type={notif.type} onClose={() => setNotif(null)} />}

      <div>
        {view === 'PROFILE' && <ProfileHeader user={user} logsCount={logs.length} />}

        <div className="p-5">
          {view === 'DASHBOARD' && (
            <div className="space-y-6 pt-4">
              <header className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-[#4A4A4A]">Hola, {user.name.split(' ')[0]}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${user.methodStartDate ? 'bg-[#C7958E] animate-pulse' : 'bg-stone-300'}`}></span>
                    <p className="text-xs text-[#5D7180] font-medium uppercase tracking-wide">
                      {user.methodStartDate
                        ? `Día ${calculateDaysOnMethod(user.methodStartDate)} del Método`
                        : 'Método no iniciado'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setView('TRACKER')} className="bg-[#C7958E] text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-rose-200 hover:scale-105 transition-transform"><Activity size={20} /></button>
              </header>

              {/* START METHOD CTA */}
              {!user.methodStartDate && (
                <div className="bg-gradient-to-r from-[#C7958E] to-[#95706B] p-6 rounded-3xl shadow-xl text-white relative overflow-hidden animate-in slide-in-from-top duration-500">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white/20 p-2 rounded-full"><Play size={20} fill="currentColor" /></div>
                      <h3 className="font-bold text-lg">Tu viaje comienza hoy</h3>
                    </div>
                    <p className="text-xs text-rose-50 mb-6 leading-relaxed opacity-90">
                      Cuando estés lista para empezar el conteo de las 12 semanas, pulsa este botón.
                    </p>
                    <button onClick={startMethod} className="w-full bg-white text-[#95706B] py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-rose-50 transition-colors">
                      🌸 INICIAR MÉTODO (Día 1)
                    </button>
                  </div>
                  <img src={BRAND_ASSETS.phase0} className="absolute -bottom-4 -right-4 w-32 h-32 opacity-20 rotate-12" />
                </div>
              )}

              {/* BODY & VITALITY CARDS (PRO) */}
              <div className="grid grid-cols-2 gap-4">
                {/* BMI CARD */}
                {(() => {
                  const { status, color, bg } = getBMIStatus(calculateBMI(user.weight, user.height));
                  return (
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#F4F0ED] flex flex-col justify-between h-full">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] text-[#5D7180] font-bold uppercase tracking-wider block">Tu Cuerpo</span>
                          <Scale size={16} className="text-[#C7958E]" />
                        </div>
                        <span className="text-3xl font-bold text-[#4A4A4A]">{calculateBMI(user.weight, user.height)}</span>
                        <span className="text-[10px] text-stone-400 ml-1">IMC</span>
                      </div>
                      <div className={`text-[9px] font-bold ${color} ${bg} px-2 py-1 rounded-md w-fit mt-2`}>
                        {status}
                      </div>
                    </div>
                  );
                })()}

                {/* VITALITY CARD */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#F4F0ED] flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] text-[#5D7180] font-bold uppercase tracking-wider block">Vitalidad (7d)</span>
                      <Sun size={16} className="text-amber-500" />
                    </div>
                    <span className="text-3xl font-bold text-[#4A4A4A]">{calculateVitalityStats(logs)}</span>
                    <span className="text-[10px] text-stone-400 ml-1">Batería</span>
                  </div>
                  <div className="text-[9px] text-[#5D7180] bg-stone-50 px-2 py-1 rounded-md w-fit mt-2 flex items-center gap-1">
                    <Activity size={8} /> Sol + Movimiento
                  </div>
                </div>
              </div>

              {/* LAST LOG DETAIL */}
              <div>
                <h3 className="font-bold text-[#4A4A4A] mb-2 text-sm uppercase tracking-wider opacity-80 flex items-center justify-between">
                  Último Registro
                  <span className="text-[10px] bg-stone-100 px-2 py-0.5 rounded-full text-stone-500">{logs.length > 0 ? getLastLogDetails(logs).date : '-'}</span>
                </h3>
                {logs.length > 0 ? <LogHistoryItem log={logs[0]} /> : (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-stone-300 text-center text-stone-400 text-sm">
                    No hay registros aún. Empieza tu diario hoy.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StatCard title="Racha Sin Alcohol" value={calculateAlcoholFreeStreak(logs)} unit="días" icon={WineOff} hideTarget={true} />
                <StatCard title="Sueño Promedio" value={calculateAverages(logs).sleep} target="7.5" unit="h" icon={Moon} />
                <StatCard title="Nivel Estrés" value={calculateAverages(logs).stress} target="2.0" unit="/5" icon={Smile} />
              </div>

              <div>
                <h3 className="font-bold text-[#4A4A4A] mb-4 text-sm uppercase tracking-wider opacity-80">Acceso Rápido</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setView('EDUCATION')} className="bg-white p-4 rounded-2xl shadow-sm border border-[#F4F0ED] flex flex-col items-center gap-2 hover:border-[#C7958E] transition-colors group">
                    <div className="bg-[#C7958E]/10 p-3 rounded-full text-[#C7958E] group-hover:bg-[#C7958E] group-hover:text-white transition-colors"><BookOpen size={20} /></div>
                    <span className="text-xs font-bold text-[#5D7180]">Aprende</span>
                  </button>
                  <button onClick={() => setView('CONSULTATIONS')} className="bg-white p-4 rounded-2xl shadow-sm border border-[#F4F0ED] flex flex-col items-center gap-2 hover:border-[#C7958E] transition-colors group">
                    <div className="bg-[#95706B]/10 p-3 rounded-full text-[#95706B] group-hover:bg-[#95706B] group-hover:text-white transition-colors"><FileText size={20} /></div>
                    <span className="text-xs font-bold text-[#5D7180]">Consultas</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {view === 'TRACKER' && <TrackerView logData={todayLog} onSave={saveDailyLog} onChangeDate={(date) => setTodayLog({ ...todayLog, date })} logs={logs} />}
          {view === 'EDUCATION' && <EducationView courseModules={courseModules} setActiveLesson={setActiveLesson} />}
          {view === 'CONSULTATIONS' && <ConsultationsView user={user} submittedForms={submittedForms} logs={logs} fetchUserForms={fetchUserForms} showNotif={showNotif} onProfileUpdate={(updates: any) => setUser(prev => prev ? ({ ...prev, ...updates }) : null)} />}
          {view === 'SPECIALIST' && <SpecialistView pendingForms={pendingForms} approveForm={approveForm} />}
          {view === 'PROFILE' && (
            <div className="pb-24">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#F4F0ED] mb-6">
                <h3 className="font-bold text-[#C7958E] mb-4 uppercase text-xs tracking-widest">Tu Plan</h3>
                <div className="flex justify-between text-sm border-b border-[#F4F0ED] pb-3 mb-3">
                  <span className="text-[#5D7180]">Objetivo</span>
                  <span className="font-bold text-[#4A4A4A]">{user.mainObjective || '-'}</span>
                </div>
              </div>

              {/* INFORMES GENERADOS */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#F4F0ED] mb-6">
                <h3 className="font-bold text-[#95706B] mb-4 uppercase text-xs tracking-widest">Informes Disponibles</h3>
                {reports.length > 0 ? (
                  <div className="space-y-3">
                    {reports.map(r => (
                      <a href={r.report_url} target="_blank" key={r.id} className="flex items-center justify-between p-3 bg-[#F4F0ED]/50 rounded-xl hover:bg-[#C7958E]/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-[#C7958E]" />
                          <span className="text-sm font-bold text-[#4A4A4A]">{r.title}</span>
                        </div>
                        <Download size={16} className="text-[#95706B]" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#5D7180] italic">Aún no tienes informes generados.</p>
                )}
              </div>

              <button onClick={handleLogout} className="w-full border-2 border-[#C7958E]/30 text-[#C7958E] py-4 rounded-2xl font-bold mt-4 hover:bg-[#C7958E] hover:text-white transition-colors flex items-center justify-center gap-2">
                <LogOut size={20} /> Cerrar Sesión
              </button>

              {/* DEV / ADMIN TOOLS TOGGLE */}
              <div className="mt-10 text-center flex items-center justify-center gap-4">
                <button onClick={() => setDbMissing(true)} className="text-[10px] text-stone-300 flex items-center justify-center gap-1 hover:text-stone-400 uppercase tracking-widest"><Database size={10} /> Admin SQL</button>
                <button onClick={() => setSpecialistMode(!specialistMode)} className={`text-[10px] flex items-center justify-center gap-1 uppercase tracking-widest transition-colors ${specialistMode ? 'text-emerald-500 font-bold' : 'text-stone-300'}`}><Stethoscope size={10} /> Modo Especialista</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-[#F4F0ED] px-6 py-2 flex justify-between rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
        <NavButton active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} icon={Heart} label="Inicio" />
        <NavButton active={view === 'TRACKER'} onClick={() => setView('TRACKER')} icon={Activity} label="Diario" />
        <NavButton active={view === 'EDUCATION'} onClick={() => setView('EDUCATION')} icon={BookOpen} label="Aprende" />
        {specialistMode ? (
          <NavButton active={view === 'SPECIALIST'} onClick={() => setView('SPECIALIST')} icon={Stethoscope} label="Especialista" />
        ) : (
          <NavButton active={view === 'CONSULTATIONS'} onClick={() => setView('CONSULTATIONS')} icon={FileText} label="Consultas" />
        )}
        <NavButton active={view === 'PROFILE'} onClick={() => setView('PROFILE')} icon={User} label="Perfil" />
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
