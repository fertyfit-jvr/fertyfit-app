export interface UserProfile {
  id?: string; // Supabase Auth ID
  email?: string;
  name: string;
  joinedAt?: string; // Date of registration
  methodStartDate?: string; // Date user clicked "Start Method"
  age: number;
  birthDate?: string; // Date of birth (YYYY-MM-DD) - used to calculate age
  weight: number;
  height: number;
  timeTrying?: number; // Calculated dynamically from timeTryingStartDate and timeTryingInitialMonths
  timeTryingStartDate?: string; // Date when user first registered time trying (YYYY-MM-DD)
  timeTryingInitialMonths?: number; // Initial months value at registration
  treatments: string[];
  isOnboarded: boolean;
  role?: 'user' | 'especialista' | 'admin'; // Role en la plataforma
  user_type?: 'free' | 'premium' | 'vip'; // Tier de acceso

  // Stripe / Suscripción
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing';
  payment_mode?: 'monthly' | 'full';
  subscription_start?: string;
  subscription_end?: string;

  // Basic profile fields from F0
  mainObjective?: string; // Concepción natural vs RA (q4_objective)
  partnerStatus?: string; // Pareja vs Solitario (q5_partner)
  familyHistory?: string; // Antecedentes familiares (q21_family_history)
  surgicalHistory?: string; // Historia quirúrgica
  obstetricHistory?: string; // Historia obstétrica
  fertilityTreatments?: string; // Tratamientos previos (q20_fertility_treatments)
  diagnoses?: string; // Diagnósticos/Historia médica (q9_diagnoses) - TEXT field

  // Cycle tracking fields (updated from Tracker and FUNCTION pillar)
  cycleLength?: number;
  cycleRegularity?: 'Regular' | 'Irregular';
  lastPeriodDate?: string;
  periodHistory?: string[]; // Historial de fechas de períodos para auto-cálculo del ciclo promedio

  // UI fields (not in DB)
  recentBloodwork?: boolean;

  // Consent fields
  consent_personal_data?: boolean;
  consent_food?: boolean;
  consent_flora?: boolean;
  consent_flow?: boolean;
  consent_function?: boolean;
  consent_daily_log?: boolean;
  consent_no_diagnosis?: boolean;
  consents_at?: string;

  // Health & Lifestyle
  smoker?: string;
  alcoholConsumption?: string;
  supplements?: string;
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
  answer: string | number | boolean | string[] | Record<string, any>;
}

export interface ConsultationForm {
  id?: number;
  user_id?: string;
  form_type: 'F0' | 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW' | 'EXAM';
  submitted_at?: string;
  updated_at?: string;

  answers: FormAnswer[]; // Structured answers
  observations: string;
  status: 'pending' | 'reviewed';
  snapshot_stats?: any;
}


export type NotificationType = 'insight' | 'alert' | 'tip' | 'celebration' | 'opportunity' | 'confirmation' | 'REPORT' | 'LABS' | 'CHAT';

/**
 * Strict type for notification handlers
 * Only these handlers are valid and will be processed
 */
export type NotificationHandler =
  | 'handlePeriodConfirmed'
  | 'handlePeriodDelayed'
  | 'handleOvulationDetected';

/**
 * Validates if a string is a valid NotificationHandler
 */
export const isValidNotificationHandler = (handler: string): handler is NotificationHandler => {
  return ['handlePeriodConfirmed', 'handlePeriodDelayed', 'handleOvulationDetected'].includes(handler);
};

export interface NotificationAction {
  label: string;
  handler: NotificationHandler;
  value?: string | number; // More specific than 'any'
}

export interface NotificationMetadata {
  ruleId?: string;
  actions?: NotificationAction[];
  deleted?: boolean;
  format?: 'markdown' | 'plain';
  [key: string]: any;
}

export interface AppNotification {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: 1 | 2 | 3;
  is_read: boolean;
  created_at: string;
  metadata?: NotificationMetadata;
}

export type ViewState = 'ONBOARDING' | 'DISCLAIMER' | 'DASHBOARD' | 'TRACKER' | 'EDUCATION' | 'CONSULTATIONS' | 'PROFILE' | 'MY_PROFILE' | 'ANALYTICS' | 'REPORTS' | 'CHAT' | 'CHECKOUT';

// ============================================================
// TIPOS DE SUSCRIPCIÓN
// ============================================================

export type UserTier = 'free' | 'premium' | 'vip';

export type PlanId = 'premium_monthly' | 'premium_full' | 'vip_monthly' | 'vip_full';

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  tier: 'premium' | 'vip';
  paymentMode: 'monthly' | 'full';
  priceMonths: number; // número de meses cubiertos
  stripePriceId?: string; // se añadirá cuando esté Stripe configurado
}


/**
 * Helper function to check if a notification type is an AI-generated notification
 */
export function isAINotification(type: NotificationType | string): boolean {
  // AI notifications can be from NotificationType or custom types from database
  const aiTypes = ['insight', 'tip', 'opportunity', 'REPORT', 'CHAT', 'LABS'];
  return aiTypes.includes(type);
}
