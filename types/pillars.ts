/**
 * Type definitions for pillar tables
 * These represent the current state of each pillar (one row per user)
 */

export interface PillarFunction {
  user_id: string;
  hormonal_panel?: Record<string, any>;
  metabolic_panel?: Record<string, any>;
  vitamin_d?: Record<string, any>;
  ultrasound?: Record<string, any>;
  hsg?: Record<string, any>;
  semen_analysis?: Record<string, any>;
  diagnoses?: string[];
  fertility_treatments?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PillarFood {
  user_id: string;
  daily_protein?: number;
  daily_fiber?: number;
  vegetable_diversity?: number;
  ultraprocessed?: string;
  omega3?: string;
  meal_schedule?: string;
  digestive_symptoms?: string;
  bristol_scale?: number;
  weekly_exercise?: string;
  waist_circumference?: number;
  alcohol_consumption?: string;
  supplements?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PillarFlora {
  user_id: string;
  antibiotics_last_12_months?: string;
  vaginal_infections?: boolean;
  altered_vaginal_ph?: boolean;
  previous_probiotics?: boolean;
  birth_lactation?: string;
  bristol_stool_scale?: number;
  microbiome_tests?: string;
  recommended_supplements?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PillarFlow {
  user_id: string;
  mental_load?: number; // 0-4
  mental_rumination?: number; // 0-4
  physical_anxiety?: boolean;
  alertness?: number; // 0-4
  regulation_tools?: boolean;
  social_pressure?: number; // 0-4
  emotional_support?: boolean;
  loneliness?: number; // 0-4
  frequent_conflicts?: boolean;
  sleep_quality?: number; // 0-4
  nocturnal_awakenings?: string;
  nighttime_screen_use?: number; // 0-4
  sleep_hours_avg?: number;
  nap?: string;
  morning_energy?: number; // 0-4
  afternoon_energy?: number; // 0-4
  coffee_cups?: number; // 0-6
  libido?: number; // 0-4
  emotional_connection_partner?: number; // 0-4
  pain_dryness_relationships?: boolean;
  fertility_anxiety_relationships?: boolean;
  off_schedule_snacks?: string;
  stress_level?: number; // 1-5 (migrated from F0)
  smoker?: string; // (migrated from F0)
  created_at?: string;
  updated_at?: string;
}

export type PillarType = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';
export type PillarData = PillarFunction | PillarFood | PillarFlora | PillarFlow;
