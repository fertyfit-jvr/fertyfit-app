import { CourseModule, DailyLog } from './types';

// --- ⚠️ ZONA DE CONFIGURACIÓN DE IMÁGENES ⚠️ ---
// IMÁGENES REALES DE FERTYFIT
export const BRAND_ASSETS = {
  logo: "https://zoanaxbpbklpbhtcqiwb.supabase.co/storage/v1/object/public/assets/fertyFit-Logo.png",
  favicon: "https://zoanaxbpbklpbhtcqiwb.supabase.co/storage/v1/object/public/assets/faviconFertyFit.png",
  phase0: "https://zoanaxbpbklpbhtcqiwb.supabase.co/storage/v1/object/public/assets/11.png",           // Icono Bienvenida
  phase1: "https://zoanaxbpbklpbhtcqiwb.supabase.co/storage/v1/object/public/assets/DESPERTAR-2.png",   // Icono Fase 1
  phase2: "https://zoanaxbpbklpbhtcqiwb.supabase.co/storage/v1/object/public/assets/REEQUILIBRIO-2.png", // Icono Fase 2
  phase3: "https://zoanaxbpbklpbhtcqiwb.supabase.co/storage/v1/object/public/assets/IMPULSO-2.png",     // Icono Fase 3
};

export const SYMPTOM_OPTIONS = [
  "Dolor ovulatorio",
  "Hinchazón",
  "Sensibilidad mamaria",
  "Cefalea",
  "Acné",
  "Cambios de humor",
  "Cólicos",
  "Fatiga",
  "Náuseas",
  "Antojos dulces",
  "Insomnio",
  "Libido alta",
  "Libido baja"
];

// Síntomas específicos para el período menstrual (usado en popup inicial)
export const PERIOD_SYMPTOM_OPTIONS = [
  "Hinchazón",
  "Dolor",
  "Apatía",
  "Enfado",
  "Sin síntomas"
];

export const MUCUS_OPTIONS = ['Seco', 'Pegajoso', 'Cremoso', 'Clara de huevo', 'Acuoso'];
export const CERVIX_HEIGHT_OPTIONS = ['Bajo', 'Alto'];
export const CERVIX_FIRM_OPTIONS = ['Duro', 'Blando'];
export const CERVIX_OPEN_OPTIONS = ['Cerrado', 'Abierto'];
export const LH_OPTIONS = ['Positivo', 'Negativo', 'No realizado'];

export const INITIAL_MODULES: CourseModule[] = [
  // FASE 0: BIENVENIDA
  {
    id: 0,
    title: "Bienvenida: El Inicio de tu Transformación",
    description: "Lo que necesitas saber antes de empezar.",
    order_index: 0,
    phase: 0,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { 
        id: 10, 
        module_id: 0, 
        title: "Bienvenida al Método FertyFit", 
        duration: "8 min", 
        type: "video",
        content_url: "https://www.youtube.com/embed/inpok4MKVLM" // Video seguro de meditación
      },
      { id: 11, module_id: 0, title: "Cómo usar esta App", duration: "5 min", type: "video" },
      { 
        id: 12, 
        module_id: 0, 
        title: "Tu compromiso contigo misma", 
        duration: "N/A", 
        type: "pdf",
        content_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" // PDF Ejemplo
      }
    ]
  },
  // FASE 1
  {
    id: 1,
    title: "Módulo 1: Fundamentos de la Fertilidad",
    description: "Entendiendo tu cuerpo y el método FertyFit.",
    order_index: 1,
    phase: 1,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { id: 101, module_id: 1, title: "Fisiología del Ciclo", duration: "15 min", type: "video" },
      { id: 102, module_id: 1, title: "Guía de Biomarcadores", duration: "10 min", type: "pdf" }
    ]
  },
  {
    id: 2,
    title: "Módulo 2: Nutrición Pro-Fértil",
    description: "Alimentos que potencian tu salud reproductiva.",
    order_index: 2,
    phase: 1,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { id: 201, module_id: 2, title: "Macronutrientes", duration: "20 min", type: "video" },
      { id: 202, module_id: 2, title: "Lista de la compra", duration: "N/A", type: "pdf" }
    ]
  },
  {
    id: 3,
    title: "Módulo 3: Ciclo Circadiano y Sueño",
    description: "La importancia del descanso en las hormonas.",
    order_index: 3,
    phase: 1,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { id: 301, module_id: 3, title: "Higiene del sueño", duration: "15 min", type: "video" }
    ]
  },
  {
    id: 4,
    title: "Módulo 4: Gestión del Estrés",
    description: "Impacto del cortisol en la ovulación.",
    order_index: 4,
    phase: 1,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { id: 401, module_id: 4, title: "Técnicas de respiración", duration: "12 min", type: "video" }
    ]
  },
  // FASE 2
  {
    id: 5,
    title: "Módulo 5: Tóxicos Ambientales",
    description: "Reduciendo la carga tóxica en tu hogar.",
    order_index: 5,
    phase: 2,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { id: 501, module_id: 5, title: "Disruptores endocrinos", duration: "18 min", type: "video" }
    ]
  },
  {
    id: 6,
    title: "Módulo 6: Suplementación Específica",
    description: "Qué tomar y por qué (guía educativa).",
    order_index: 6,
    phase: 2,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { id: 601, module_id: 6, title: "Guía de suplementos", duration: "N/A", type: "pdf" }
    ]
  },
  {
    id: 7,
    title: "Módulo 7: Ejercicio y Movimiento",
    description: "Entrenando según la fase de tu ciclo.",
    order_index: 7,
    phase: 2,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { id: 701, module_id: 7, title: "Fase Folicular vs Lútea", duration: "20 min", type: "video" }
    ]
  },
  {
    id: 8,
    title: "Módulo 8: Manejo Emocional",
    description: "Plan de bienestar emocional.",
    order_index: 8,
    phase: 2,
    isCompleted: false,
    completedLessons: [],
    lessons: [
      { id: 801, module_id: 8, title: "Mindset Fértil", duration: "15 min", type: "video" }
    ]
  },
  // FASE 3
  {
    id: 9,
    title: "Módulo 9: Organización Carpeta",
    description: "Preparación para consulta.",
    order_index: 9,
    phase: 3,
    isCompleted: false,
    completedLessons: [],
    lessons: []
  }
];

// Helper to generate some fake historical data for the chart
export const generateMockData = (): DailyLog[] => {
  const logs: DailyLog[] = [];
  const today = new Date();
  for (let i = 20; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    
    // Simulate a temperature shift around day 14
    const cycleDay = (20 - i) + 1;
    let baseTemp = 36.4;
    if (cycleDay > 14) baseTemp = 36.8;

    logs.push({
      date: d.toISOString().split('T')[0],
      cycleDay: cycleDay,
      bbt: baseTemp + (Math.random() * 0.2 - 0.1),
      mucus: cycleDay === 13 || cycleDay === 14 ? 'Clara de huevo' : (cycleDay > 14 ? 'Seco' : 'Cremoso'),
      lhTest: cycleDay === 13 ? 'Positivo' : (cycleDay > 10 && cycleDay < 16 ? 'Negativo' : 'No realizado'),
      symptoms: [],
      sex: cycleDay === 12 || cycleDay === 14,
      sleepQuality: Math.floor(Math.random() * 2) + 3,
      sleepHours: 7 + Math.floor(Math.random() * 2),
      stressLevel: Math.floor(Math.random() * 3) + 1,
      activityMinutes: 30,
      sunMinutes: 15,
      waterGlasses: 8,
      veggieServings: 3,
      alcohol: false
    });
  }
  return logs;
};