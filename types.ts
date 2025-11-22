
export interface UserProfile {
  id?: string; // Supabase Auth ID
  email?: string;
  name: string;
  joinedAt?: string; // Date of registration
  methodStartDate?: string; // Date user clicked "Start Method"
  age: number;
  weight: number;
  height: number;
  timeTrying: string; // e.g., "1 year"
  diagnoses: string[];
  treatments: string[];
  disclaimerAccepted: boolean;
  isOnboarded: boolean;
  role?: 'user' | 'admin' | 'specialist'; // New Role field

  // New fields from PDF
  mainObjective?: string; // Concepción natural vs RA
  partnerStatus?: string; // Pareja vs Solitario
  cycleLength?: number;
  cycleRegularity?: 'Regular' | 'Irregular';
  lastPeriodDate?: string;
  surgicalHistory?: string;
  obstetricHistory?: string;
  fertilityTreatments?: string;
  supplements?: string;
  smoker?: string; // "No" or quantity
  alcoholConsumption?: string; // "No" or quantity
  recentBloodwork?: boolean;
}

export type MucusType = 'Seco' | 'Pegajoso' | 'Cremoso' | 'Clara de huevo' | 'Acuoso';
export type CervixHeight = 'Bajo' | 'Alto' | '';
export type CervixFirmness = 'Duro' | 'Blando' | '';
export type CervixOpenness = 'Cerrado' | 'Abierto' | '';
export type LHResult = 'Positivo' | 'Negativo' | 'No realizado';

export interface DailyLog {
  id?: number; // Database ID
  user_id?: string;
  date: string; // ISO string YYYY-MM-DD
  cycleDay: number;
  
  // Physiological
  bbt: number | null; // Basal Body Temp
  mucus: MucusType | '';
  cervixHeight?: CervixHeight;
  cervixFirmness?: CervixFirmness;
  cervixOpenness?: CervixOpenness;
  lhTest: LHResult;
  symptoms: string[]; // Array of selected symptoms
  sex: boolean;

  // Lifestyle / Wellness
  sleepQuality: number; // 1-5
  sleepHours: number;
  stressLevel: number; // 1-5
  activityMinutes: number;
  sunMinutes: number;
  waterGlasses: number;
  veggieServings: number;
  alcohol: boolean;
  alcoholUnits?: number;
}

export interface Lesson {
  id: number;
  module_id: number;
  title: string;
  description?: string; // Added description
  duration: string;
  type: 'video' | 'pdf';
  content_url?: string;
}

export interface CourseModule {
  id: number;
  title: string;
  description: string;
  order_index: number;
  phase: 0 | 1 | 2 | 3; // Phase 0 is Welcome
  lessons: Lesson[];
  // UI Helper props
  completedLessons: number[]; 
  isCompleted?: boolean;
  isLocked?: boolean; // UI state
}

export interface FormAnswer {
  questionId: string;
  question: string;
  answer: string | number | boolean | string[];
}

export interface ConsultationForm {
  id?: number;
  user_id?: string;
  form_type: 'F0' | 'F1' | 'F2' | 'F3';
  submitted_at?: string;
  snapshot_stats: any; 
  answers: FormAnswer[]; // Structured answers
  observations: string;
  status: 'pending' | 'reviewed';
  report_url?: string; // URL to the PDF report if reviewed
}

export interface AdminReport {
  id: number;
  title: string;
  report_url: string;
  created_at: string;
}

export type ViewState = 'ONBOARDING' | 'DISCLAIMER' | 'DASHBOARD' | 'TRACKER' | 'EDUCATION' | 'CONSULTATIONS' | 'PROFILE' | 'SPECIALIST';
