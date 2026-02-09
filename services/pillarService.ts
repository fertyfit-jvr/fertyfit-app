/**
 * Service for managing pillar data
 * Implements dual saving: updates pillar_* tables (current state) 
 * and inserts into consultation_forms (historical record)
 */

import { supabase } from './supabase';
import { logger } from '../lib/logger';
import { calculateAverages } from './dataService';
import { FormAnswer, ConsultationForm, DailyLog } from '../types';
import { PillarFunction, PillarFood, PillarFlora, PillarFlow, PillarType, PillarData } from '../types/pillars';
import { fetchProfileForUser, fetchLogsForUser } from './userDataService';
import { calculateAndSaveScore, FertyPillars } from './fertyscoreService';

type PillarFormType = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';


function normalizeAnswersToPillar(
  formType: PillarFormType,
  answers: Record<string, any>
): Partial<PillarFunction | PillarFood | PillarFlora | PillarFlow> {
  const normalized: any = {};

  switch (formType) {
    case 'FUNCTION':
      // Ciclo (movido desde F0)
      if (answers['function_cycle_length']) {
        normalized.cycle_length = parseFloat(answers['function_cycle_length'])
          || parseInt(answers['function_cycle_length']);
      }

      // Nuevas preguntas FUNCTION
      normalized.regularity_detail = answers['function_regularity_detail'];
      normalized.knows_fertile_days = answers['function_knows_fertile_days'];

      if (answers['function_luteal_phase']) {
        normalized.luteal_phase_days = parseInt(answers['function_luteal_phase']);
      }

      normalized.fertile_mucus = answers['function_fertile_mucus'];

      if (answers['function_pms_severity']) {
        normalized.pms_severity = parseInt(answers['function_pms_severity']);
      }

      normalized.fertility_diagnosis = answers['function_fertility_diagnosis'];
      normalized.ovulation_tracking = answers['function_ovulation_tracking'];
      normalized.menstrual_bleeding = answers['function_menstrual_bleeding'];

      // Mantener si los necesitas
      if (answers['q9_diagnoses']) {
        const diagnosesStr = String(answers['q9_diagnoses']);
        normalized.diagnoses = diagnosesStr.split('\n').filter(d => d.trim());
      }
      if (answers['q20_fertility_treatments']) {
        normalized.fertility_treatments = String(answers['q20_fertility_treatments']);
      }
      break;

    case 'FOOD':
      // ⭐ NUEVOS CAMPOS (sistema de puntos)
      normalized.eating_pattern = answers['food_patron'] ? String(answers['food_patron']) : undefined;

      if (answers['food_pescado']) {
        normalized.fish_frequency = parseInt(answers['food_pescado']);
      }

      if (answers['food_vege']) {
        normalized.vegetable_servings = parseInt(answers['food_vege']);
      }

      normalized.fat_type = answers['food_grasas'] ? String(answers['food_grasas']) : undefined;
      normalized.fertility_supplements = answers['food_suppl'] ? String(answers['food_suppl']) : undefined;

      if (answers['food_azucar'] != null) {
        normalized.sugary_drinks_frequency = parseInt(String(answers['food_azucar']));
      }

      normalized.antioxidants = answers['food_antiox'] ? String(answers['food_antiox']) : undefined;
      normalized.carb_source = answers['food_carbos'] ? String(answers['food_carbos']) : undefined;

      // ❌ MANTENER CAMPOS ANTIGUOS (para compatibilidad con datos existentes)
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
      // ⭐ NUEVOS CAMPOS (sistema de puntos)
      if (answers['flora_dig'] != null) {
        const v = parseInt(String(answers['flora_dig']));
        normalized.digestive_health = v >= 1 && v <= 7 ? Math.round(v * 10 / 7) : v;
      }

      normalized.vaginal_health = answers['flora_vag'] ? String(answers['flora_vag']) : undefined;
      normalized.antibiotics_last_year = answers['flora_atb'] ? String(answers['flora_atb']) : undefined;

      if (answers['flora_ferm']) {
        normalized.fermented_foods_frequency = parseInt(answers['flora_ferm']);
      }

      const floraIntol = answers['flora_intol'] ? String(answers['flora_intol']) : undefined;
      const floraIntolDetalle = answers['flora_intol_detalle'] ? String(answers['flora_intol_detalle']) : undefined;
      normalized.food_intolerances = floraIntol
        ? (floraIntolDetalle ? `${floraIntol}: ${floraIntolDetalle}` : floraIntol)
        : undefined;

      // Nuevos campos Flora (síntomas, SIBO, H.Pylori, piel, cabello)
      normalized.digestive_symptoms = Array.isArray(answers['flora_sintomas'])
        ? (answers['flora_sintomas'] as string[]).join(', ')
        : answers['flora_sintomas'] ? String(answers['flora_sintomas']) : undefined;
      normalized.sibo_diagnosed = answers['flora_sibo'] === 'Sí';
      normalized.hpylori_diagnosed = answers['flora_hpylori'] === 'Sí';
      const floraPiel = answers['flora_piel'] ? String(answers['flora_piel']) : undefined;
      const floraPielOtro = answers['flora_piel_otro'] ? String(answers['flora_piel_otro']) : undefined;
      normalized.skin_issues = floraPiel ? (floraPielOtro ? `${floraPiel}: ${floraPielOtro}` : floraPiel) : undefined;
      const floraCabello = answers['flora_cabello'] ? String(answers['flora_cabello']) : undefined;
      const floraCabelloOtro = answers['flora_cabello_otro'] ? String(answers['flora_cabello_otro']) : undefined;
      normalized.hair_issues = floraCabello ? (floraCabelloOtro ? `${floraCabello}: ${floraCabelloOtro}` : floraCabello) : undefined;
      break;

    case 'FLOW':
      // ⭐ NUEVOS CAMPOS (sistema de puntos)
      if (answers['flow_stress'] != null) {
        const v = parseInt(String(answers['flow_stress']));
        normalized.stress_level = v >= 1 && v <= 7 ? Math.round(v * 10 / 7) : v;
      }

      if (answers['flow_sueno']) {
        normalized.sleep_hours = parseFloat(answers['flow_sueno']);
      }

      if (answers['flow_relax']) {
        normalized.relaxation_frequency = parseInt(answers['flow_relax']);
      }

      const flowEjer = answers['flow_ejer'];
      normalized.exercise_type =
        flowEjer && typeof flowEjer === 'object' && Object.keys(flowEjer).length > 0
          ? JSON.stringify(flowEjer)
          : flowEjer && typeof flowEjer === 'string' && flowEjer !== 'Ninguno'
            ? flowEjer
            : undefined;
      normalized.morning_sunlight = answers['flow_solar'] ? String(answers['flow_solar']) : undefined;
      normalized.endocrine_disruptors = answers['flow_tox'] ? String(answers['flow_tox']) : undefined;
      normalized.bedtime_routine = answers['flow_noche'] ? String(answers['flow_noche']) : undefined;

      const flowEntorno = answers['flow_entorno_social'];
      const flowEntornoOtro = answers['flow_entorno_social_otro'];
      if (flowEntorno && typeof flowEntorno === 'string') {
        normalized.social_environment = flowEntornoOtro
          ? `${flowEntorno}::${flowEntornoOtro}`
          : flowEntorno;
      }

      normalized.healthy_relationships = answers['flow_relaciones_saludables'] === 'Sí';

      if (answers['flow_emocion'] != null) {
        const v = parseInt(String(answers['flow_emocion']));
        normalized.emotional_state = v >= 1 && v <= 7 ? Math.round(v * 10 / 7) : v;
      }

      // Nuevas preguntas Flow
      if (answers['flow_calidad_sueno'] != null) {
        normalized.sleep_quality = parseInt(String(answers['flow_calidad_sueno']));
      }
      if (answers['flow_libido'] != null) {
        normalized.libido = parseInt(String(answers['flow_libido']));
      }
      normalized.smoker = answers['flow_fumadora'] ? String(answers['flow_fumadora']) : undefined;
      
      // Consumo de drogas (con detalle si responde Sí)
      const flowDrogas = answers['flow_drogas'];
      const flowDrogasDetalle = answers['flow_drogas_detalle'];
      if (flowDrogas === 'Sí' && flowDrogasDetalle) {
        normalized.drug_use_last_year = `Sí: ${flowDrogasDetalle}`;
      } else if (flowDrogas === 'No') {
        normalized.drug_use_last_year = 'No';
      }
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

    // 3. ⭐ SIMPLE: Si es FUNCTION y tiene cycle_length, actualizar profiles también
    if (formType === 'FUNCTION') {
      const functionData = pillarData as Partial<PillarFunction>;
      if (functionData.cycle_length) {
        const profileUpdates: any = {
          cycle_length: functionData.cycle_length
        };

        if (functionData.cycle_regularity) {
          profileUpdates.cycle_regularity = functionData.cycle_regularity === 'Regulares'
            ? 'regular'
            : 'irregular';
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);

        if (profileError) {
          logger.warn('Error syncing cycle_length to profiles:', profileError);
        } else {
          logger.log('✅ Synced cycle_length to profiles:', profileUpdates);
        }
      }
    }

    // 4. Format answers for consultation_forms (use provided or create from raw answers)
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
        submitted_at: new Date().toISOString(),
        snapshot_stats: calculateAverages(logs)
      });

    if (historyError) {
      logger.error('Error saving to consultation_forms:', historyError);
      // Don't fail completely if history save fails, but log it
      logger.warn('Pillar data saved but historical record failed');
    }

    // 5. TRIGGER: Calculate and save FertyScore
    // Fetch fresh profile and ALL pillars to ensure accuracy
    const profile = await fetchProfileForUser(userId);
    const pillars = await fetchAllPillars(userId);

    // Ensure we have logs for dynamic score (if not provided, fetch them)
    let logsForScore = logs;
    if (!logsForScore || logsForScore.length === 0) {
      const logsResult = await fetchLogsForUser(userId, 30);
      if (logsResult.success) {
        logsForScore = logsResult.data;
      }
    }

    if (profile) {
      await calculateAndSaveScore(userId, profile as any, logsForScore, pillars, 'profile_update');
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Error in savePillarForm:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all pillars for a user
 */
export async function fetchAllPillars(userId: string): Promise<FertyPillars> {
  try {
    const [func, food, flora, flow] = await Promise.all([
      fetchPillarData<PillarFunction>(userId, 'FUNCTION'),
      fetchPillarData<PillarFood>(userId, 'FOOD'),
      fetchPillarData<PillarFlora>(userId, 'FLORA'),
      fetchPillarData<PillarFlow>(userId, 'FLOW'),
    ]);

    return {
      function: func,
      food: food,
      flora: flora,
      flow: flow
    };
  } catch (error) {
    logger.error('Error fetching all pillars:', error);
    return {};
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
      if ((error as any).code === 'PGRST116' || (error as any).code === '42P01' || (error as any).status === 406) {
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
