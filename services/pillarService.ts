/**
 * Service for managing pillar data
 * Implements dual saving: updates pillar_* tables (current state) 
 * and inserts into consultation_forms (historical record)
 */

import { supabase } from './supabase';
import { logger } from '../lib/logger';
import { calculateAverages } from './dataService';
import { FormAnswer, ConsultationForm, DailyLog } from '../types';
import { PillarFunction, PillarFood, PillarFlora, PillarFlow, PillarType } from '../types/pillars';

type PillarFormType = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

/**
 * Normalizes form answers into pillar table structure
 */
function normalizeAnswersToPillar(
  formType: PillarFormType,
  answers: Record<string, any>
): Partial<PillarFunction | PillarFood | PillarFlora | PillarFlow> {
  const normalized: any = {};

  switch (formType) {
    case 'FUNCTION':
      // Group FUNCTION answers by section
      normalized.hormonal_panel = {};
      normalized.metabolic_panel = {};
      
      Object.entries(answers).forEach(([key, value]) => {
        if (key.startsWith('function_fsh') || key.startsWith('function_lh') || 
            key.startsWith('function_estradiol') || key.startsWith('function_prolactina') ||
            key.startsWith('function_tsh') || key.startsWith('function_t4') ||
            key.startsWith('function_cycle_day')) {
          normalized.hormonal_panel[key] = value;
        } else if (key.startsWith('function_glucosa') || key.startsWith('function_insulina') ||
                   key.startsWith('function_hemograma') || key.startsWith('function_ferritina') ||
                   key.startsWith('function_hierro') || key.startsWith('function_transferrina') ||
                   key.startsWith('function_saturacion') || key.startsWith('function_pcr') ||
                   key.startsWith('function_colesterol') || key.startsWith('function_trigliceridos')) {
          normalized.metabolic_panel[key] = value;
        } else if (key.startsWith('function_vitamina_d')) {
          normalized.vitamin_d = { [key]: value };
        } else if (key.startsWith('function_afc') || key.startsWith('function_endometrio') || 
                   key.startsWith('function_patron')) {
          normalized.ultrasound = { ...normalized.ultrasound, [key]: value };
        } else if (key.startsWith('function_hsg')) {
          normalized.hsg = { ...normalized.hsg, [key]: value };
        } else if (key.startsWith('function_espermio')) {
          normalized.semen_analysis = { ...normalized.semen_analysis, [key]: value };
        }
      });
      
      // Extract diagnoses and fertility_treatments if present in answers
      if (answers['q9_diagnoses']) {
        const diagnosesStr = String(answers['q9_diagnoses']);
        normalized.diagnoses = diagnosesStr.split('\n').filter(d => d.trim());
      }
      if (answers['q20_fertility_treatments']) {
        normalized.fertility_treatments = String(answers['q20_fertility_treatments']);
      }
      break;

    case 'FOOD':
      normalized.daily_protein = answers['food_proteina'] ? parseFloat(answers['food_proteina']) : undefined;
      normalized.daily_fiber = answers['food_fibra'] ? parseFloat(answers['food_fibra']) : undefined;
      normalized.vegetable_diversity = answers['food_diversidad'] ? parseInt(answers['food_diversidad']) : undefined;
      normalized.ultraprocessed = answers['food_ultraprocesados'] ? String(answers['food_ultraprocesados']) : undefined;
      normalized.omega3 = answers['food_omega'] ? String(answers['food_omega']) : undefined;
      normalized.meal_schedule = answers['food_horarios'] ? String(answers['food_horarios']) : undefined;
      normalized.digestive_symptoms = answers['food_digestivo'] ? String(answers['food_digestivo']) : undefined;
      normalized.bristol_scale = answers['food_bristol'] ? parseInt(answers['food_bristol']) : undefined;
      normalized.weekly_exercise = answers['food_entrenamiento'] ? String(answers['food_entrenamiento']) : undefined;
      normalized.waist_circumference = answers['food_cintura'] ? parseFloat(answers['food_cintura']) : undefined;
      normalized.alcohol_consumption = answers['food_alcohol'] ? String(answers['food_alcohol']) : undefined;
      normalized.supplements = answers['food_supplements'] ? String(answers['food_supplements']) : undefined;
      break;

    case 'FLORA':
      normalized.antibiotics_last_12_months = answers['flora_antibioticos'] ? String(answers['flora_antibioticos']) : undefined;
      normalized.vaginal_infections = answers['flora_infecciones'] === 'Sí' || answers['flora_infecciones'] === true;
      normalized.altered_vaginal_ph = answers['flora_ph'] === 'Sí' || answers['flora_ph'] === true;
      normalized.previous_probiotics = answers['flora_probio'] === 'Sí' || answers['flora_probio'] === true;
      normalized.birth_lactation = answers['flora_parto'] ? String(answers['flora_parto']) : undefined;
      normalized.bristol_stool_scale = answers['flora_bristol'] ? parseInt(answers['flora_bristol']) : undefined;
      normalized.microbiome_tests = answers['flora_pruebas'] ? String(answers['flora_pruebas']) : undefined;
      normalized.recommended_supplements = answers['flora_suplementos'] ? String(answers['flora_suplementos']) : undefined;
      break;

    case 'FLOW':
      normalized.stress_level = answers['flow_stress_level'] ? parseInt(answers['flow_stress_level']) : undefined;
      normalized.sleep_hours_avg = answers['flow_sleep_hours_avg'] ? parseFloat(answers['flow_sleep_hours_avg']) : undefined;
      normalized.smoker = answers['flow_smoker'] ? String(answers['flow_smoker']) : undefined;
      normalized.mental_load = answers['flow_carga_mental'] ? parseInt(answers['flow_carga_mental']) : undefined;
      normalized.mental_rumination = answers['flow_rumiacion'] ? parseInt(answers['flow_rumiacion']) : undefined;
      normalized.physical_anxiety = answers['flow_ansiedad'] === 'Sí' || answers['flow_ansiedad'] === true;
      normalized.alertness = answers['flow_alerta'] ? parseInt(answers['flow_alerta']) : undefined;
      normalized.regulation_tools = answers['flow_regulacion'] === 'Sí' || answers['flow_regulacion'] === true;
      normalized.social_pressure = answers['flow_presion_social'] ? parseInt(answers['flow_presion_social']) : undefined;
      normalized.emotional_support = answers['flow_soporte'] === 'Sí' || answers['flow_soporte'] === true;
      normalized.loneliness = answers['flow_soledad'] ? parseInt(answers['flow_soledad']) : undefined;
      normalized.frequent_conflicts = answers['flow_conflictos'] === 'Sí' || answers['flow_conflictos'] === true;
      normalized.sleep_quality = answers['flow_sueno_calidad'] ? parseInt(answers['flow_sueno_calidad']) : undefined;
      normalized.nocturnal_awakenings = answers['flow_despertares'] ? String(answers['flow_despertares']) : undefined;
      normalized.nighttime_screen_use = answers['flow_pantallas'] ? parseInt(answers['flow_pantallas']) : undefined;
      normalized.nap = answers['flow_siesta'] ? String(answers['flow_siesta']) : undefined;
      normalized.morning_energy = answers['flow_energia_manana'] ? parseInt(answers['flow_energia_manana']) : undefined;
      normalized.afternoon_energy = answers['flow_energia_tarde'] ? parseInt(answers['flow_energia_tarde']) : undefined;
      normalized.coffee_cups = answers['flow_cafe'] ? parseInt(answers['flow_cafe']) : undefined;
      normalized.libido = answers['flow_libido'] ? parseInt(answers['flow_libido']) : undefined;
      normalized.emotional_connection_partner = answers['flow_conexion'] ? parseInt(answers['flow_conexion']) : undefined;
      normalized.pain_dryness_relationships = answers['flow_dolor'] === 'Sí' || answers['flow_dolor'] === true;
      normalized.fertility_anxiety_relationships = answers['flow_ansiedad_relaciones'] === 'Sí' || answers['flow_ansiedad_relaciones'] === true;
      normalized.off_schedule_snacks = answers['flow_snacks'] ? String(answers['flow_snacks']) : undefined;
      break;
  }

  // Remove undefined values
  Object.keys(normalized).forEach(key => {
    if (normalized[key] === undefined) {
      delete normalized[key];
    }
  });

  return normalized;
}

/**
 * Saves pillar form data with dual saving strategy:
 * 1. UPSERT to pillar_* table (current state)
 * 2. INSERT to consultation_forms (historical record)
 */
export async function savePillarForm(
  userId: string,
  formType: PillarFormType,
  answers: Record<string, any>,
  logs: DailyLog[] = [],
  formattedAnswers?: FormAnswer[] // Optional: pre-formatted answers for consultation_forms
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Normalize answers to pillar structure
    const pillarData = normalizeAnswersToPillar(formType, answers);
    pillarData.user_id = userId;

    // 2. UPSERT to pillar table (current state)
    const tableName = `pillar_${formType.toLowerCase()}`;
    const { error: pillarError } = await supabase
      .from(tableName)
      .upsert(pillarData, { onConflict: 'user_id' });

    if (pillarError) {
      logger.error(`Error saving to ${tableName}:`, pillarError);
      return { success: false, error: pillarError.message };
    }

    // 3. Format answers for consultation_forms (use provided or create from raw answers)
    const answersForHistory: FormAnswer[] = formattedAnswers || Object.entries(answers)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([questionId, value]) => {
        // Get question text from form definitions if needed
        const questionText = questionId; // Can be enhanced later
        return {
          questionId,
          question: questionText,
          answer: value
        };
      });

    // 4. INSERT to consultation_forms (historical record)
    const { error: historyError } = await supabase
      .from('consultation_forms')
      .insert({
        user_id: userId,
        form_type: formType,
        answers: answersForHistory,
        status: 'pending',
        snapshot_stats: calculateAverages(logs)
      });

    if (historyError) {
      logger.error('Error saving to consultation_forms:', historyError);
      // Don't fail completely if history save fails, but log it
      logger.warn('Pillar data saved but historical record failed');
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Error in savePillarForm:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches current state of a pillar for a user
 */
export async function fetchPillarData<T extends PillarData>(
  userId: string,
  pillarType: PillarType
): Promise<T | null> {
  try {
    const tableName = `pillar_${pillarType.toLowerCase()}`;
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Si la tabla no existe (error 406 o similar), retornar null silenciosamente
      // Esto permite que el cálculo use valores por defecto
      if (error.code === 'PGRST116' || error.code === '42P01' || error.status === 406) {
        logger.warn(`Table ${tableName} not found or not accessible, using default values`);
        return null; // No data found - will use defaults
      }
      logger.error(`Error fetching ${pillarType} pillar:`, error);
      return null;
    }

    return data as T;
  } catch (error: any) {
    // Si hay un error de conexión o tabla no existe, retornar null para usar defaults
    if (error?.code === '42P01' || error?.status === 406 || error?.message?.includes('does not exist')) {
      logger.warn(`Table pillar_${pillarType.toLowerCase()} not found, using default values`);
      return null;
    }
    logger.error(`Error in fetchPillarData for ${pillarType}:`, error);
    return null;
  }
}
