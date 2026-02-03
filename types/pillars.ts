/**
 * Type definitions for pillar tables
 * These represent the current state of each pillar (one row per user)
 */

export interface PillarFunction {
  user_id: string;
  // Ciclo (movido desde F0, sincronizado con profiles)
  cycle_length?: number;
  // Nuevas preguntas FUNCTION
  regularity_detail?: string;
  knows_fertile_days?: string; // Sí/No
  luteal_phase_days?: number;
  fertile_mucus?: string;
  pms_severity?: number; // 0-4 (antes 1-10)
  fertility_diagnosis?: string;
  ovulation_tracking?: string;
  // Mantener si los necesitas
  diagnoses?: string[];
  fertility_treatments?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PillarFood {
  user_id: string;
  // ⭐ NUEVOS CAMPOS (sistema de puntos)
  eating_pattern?: string;        // patron: patrón de alimentación semanal
  fish_frequency?: number;         // pescado: frecuencia pescado azul (0-7 veces/semana)
  vegetable_servings?: number;    // vege: raciones vegetales diarias (0-10)
  fat_type?: string;               // grasas: tipo de grasas en cocina
  fertility_supplements?: string;  // suppl: suplementos fertilidad
  sugary_drinks_frequency?: number; // azucar: frecuencia bebidas azucaradas (0-7 veces/semana)
  antioxidants?: string;           // antiox: fuentes de antioxidantes
  carb_source?: string;            // carbos: principal fuente de carbohidratos
  // ❌ CAMPOS ANTIGUOS (mantener por compatibilidad con datos existentes)
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
  // ⭐ NUEVOS CAMPOS (sistema de puntos)
  digestive_health?: number;        // dig: salud digestiva (0-10, slider)
  vaginal_health?: string;          // vag: salud vaginal
  antibiotics_last_year?: string;   // atb: antibióticos último año
  fermented_foods_frequency?: number; // ferm: frecuencia alimentos fermentados (0-7 veces/semana)
  food_intolerances?: string;        // intol: intolerancias alimentarias
  // Nuevos campos Flora
  digestive_symptoms?: string;      // flora_sintomas: síntomas digestivos (comma-separated)
  sibo_diagnosed?: boolean;         // flora_sibo
  hpylori_diagnosed?: boolean;      // flora_hpylori
  skin_issues?: string;             // flora_piel (con _otro si aplica)
  hair_issues?: string;             // flora_cabello (con _otro si aplica)
  // ❌ CAMPOS ANTIGUOS (mantener por compatibilidad con datos existentes)
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
  // ⭐ NUEVOS CAMPOS (sistema de puntos)
  stress_level?: number;            // stress: nivel de estrés percibido (0-10, slider)
  sleep_hours?: number;              // sueno: horas de sueño de calidad (se mapea a puntos 1-10)
  relaxation_frequency?: number;     // relax: frecuencia técnicas de relajación (0-7 veces/semana, mapea a puntos 1-10)
  exercise_type?: string;           // ejer: tipo y frecuencia de ejercicio
  morning_sunlight?: string;         // solar: exposición a luz solar matutina
  endocrine_disruptors?: string;     // tox: medidas para reducir disruptores endocrinos
  bedtime_routine?: string;          // noche: rutina antes de dormir
  social_environment?: string;       // flow_entorno_social: entorno social (checkboxes + otro)
  healthy_relationships?: boolean;   // flow_relaciones_saludables: Sí/No
  emotional_state?: number;          // emocion: estado emocional respecto a búsqueda de embarazo (1-10, slider)
  // ❌ CAMPOS ANTIGUOS (mantener por compatibilidad con datos existentes)
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
  smoker?: string; // (migrated from F0)
  created_at?: string;
  updated_at?: string;
}

export type PillarType = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';
export type PillarData = PillarFunction | PillarFood | PillarFlora | PillarFlow;
