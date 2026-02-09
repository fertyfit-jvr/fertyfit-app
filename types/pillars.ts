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
  // ⭐ CAMPOS DEL FORMULARIO FOOD ACTUAL
  eating_pattern?: string;        // food_patron: patrón de alimentación semanal
  fish_frequency?: number;         // food_pescado: frecuencia pescado azul (0-7 veces/semana)
  vegetable_servings?: number;    // food_vege: raciones vegetales diarias (0-10)
  fat_type?: string;               // food_grasas: tipo de grasas en cocina
  fertility_supplements?: string;  // food_suppl: suplementos fertilidad
  sugary_drinks_frequency?: number; // food_azucar: frecuencia bebidas azucaradas (0-7 veces/semana)
  antioxidants?: string;           // food_antiox: fuentes de antioxidantes
  carb_source?: string;            // food_carbos: principal fuente de carbohidratos
  coffee_cups?: number;            // food_cafe: tazas de café al día (0-10)
  alcohol_consumption?: string;    // food_alcohol: consumo de alcohol semanal
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
  created_at?: string;
  updated_at?: string;
}

export interface PillarFlow {
  user_id: string;
  // Campos del formulario Flow actual
  stress_level?: number;            // flow_stress: nivel de estrés percibido (1-7, mapea a 0-10)
  sleep_hours?: number;             // flow_sueno: horas de sueño de calidad
  relaxation_frequency?: number;    // flow_relax: frecuencia técnicas de relajación (0-7 veces/semana)
  exercise_type?: string;           // flow_ejer: tipo y frecuencia de ejercicio (JSON)
  morning_sunlight?: string;        // flow_solar: exposición a luz solar matutina
  endocrine_disruptors?: string;    // flow_tox: medidas para reducir disruptores endocrinos
  bedtime_routine?: string;         // flow_noche: rutina antes de dormir
  social_environment?: string;      // flow_entorno_social: entorno social (con :: para "otro")
  healthy_relationships?: boolean;  // flow_relaciones_saludables: Sí/No
  emotional_state?: number;         // flow_emocion: estado emocional (1-7, mapea a 0-10)
  sleep_quality?: number;           // flow_calidad_sueno: calidad del sueño (0-4)
  libido?: number;                  // flow_libido: nivel de líbido (0-4)
  smoker?: string;                  // flow_fumadora: fumadora (opciones)
  drug_use_last_year?: string;      // flow_drogas: consumo de drogas ("No" o "Sí: detalles")
  created_at?: string;
  updated_at?: string;
}

export type PillarType = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';
export type PillarData = PillarFunction | PillarFood | PillarFlora | PillarFlow;
