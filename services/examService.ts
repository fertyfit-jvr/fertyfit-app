/**
 * Service for saving exam results to consultation_forms
 * Handles both predefined exam types and generic exams
 */

import { supabase } from './supabase';
import { logger } from '../lib/logger';
import { FormAnswer, ConsultationForm } from '../types';
import { PillarFunction } from '../types/pillars';

/**
 * Converts parsed exam data to FormAnswer[] format for consultation_forms
 */
export function convertParsedDataToFormAnswers(
  parsedData: Record<string, any>,
  examType?: string
): FormAnswer[] {
  const answers: FormAnswer[] = [];

  // Add exam type as first answer if provided
  if (examType) {
    answers.push({
      questionId: 'exam_type',
      question: 'Tipo de examen',
      answer: examType
    });
  }

  // Convert each field in parsedData to FormAnswer
  Object.entries(parsedData).forEach(([key, value]) => {
    // Skip null/undefined/empty values
    if (value === null || value === undefined || value === '') {
      return;
    }

    // Create a human-readable question label from the key
    const questionLabel = formatFieldNameToLabel(key);

    answers.push({
      questionId: key,
      question: questionLabel,
      answer: value
    });
  });

  return answers;
}

/**
 * Formats a field name (e.g., "function_fsh") to a human-readable label
 */
function formatFieldNameToLabel(fieldName: string): string {
  // Remove common prefixes
  let label = fieldName
    .replace(/^function_/i, '')
    .replace(/^exam_/i, '')
    .replace(/_/g, ' ');

  // Capitalize first letter of each word
  label = label
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return label;
}

/**
 * Saves exam results to consultation_forms
 * Can handle both predefined exam types (FUNCTION) and generic exams
 */
export async function saveExamToConsultationForms(
  userId: string,
  parsedData: Record<string, any>,
  examType?: string,
  examTypeDetected?: string,
  rawText?: string,
  rawGeminiData?: any,
  validationComment?: string
): Promise<{ success: boolean; error?: string; formId?: number }> {
  try {
    // Convert parsed data to FormAnswer format
    const finalExamType = examTypeDetected || examType || 'unknown';
    const answers = convertParsedDataToFormAnswers(parsedData, finalExamType);

    if (answers.length === 0) {
      logger.warn('No data to save from exam');
      return { success: false, error: 'No se encontraron datos para guardar' };
    }

    // Añadir comentario de validación como respuesta estructurada si existe
    if (validationComment) {
      answers.push({
        questionId: 'gemini_comment',
        question: 'Comentario de validación del examen (Gemini)',
        answer: validationComment,
      });
    }

    // Construir observaciones con:
    // - Comentario de validación (warnings/errores)
    // - Datos originales de Gemini (raw)
    // - Texto del examen (si existe)
    const observationsParts: string[] = [];

    if (validationComment) {
      observationsParts.push(`Comentario de validación:\n${validationComment}`);
    }

    if (rawGeminiData) {
      observationsParts.push(`Datos originales de Gemini:\n${JSON.stringify(rawGeminiData, null, 2)}`);
    }

    if (rawText) {
      observationsParts.push(
        `Texto extraído del examen:\n${rawText.substring(0, 1000)}${rawText.length > 1000 ? '...' : ''}`
      );
    }

    const observations = observationsParts.join('\n\n---\n\n');

    // Determine form_type
    // If it's a predefined type, use 'FUNCTION', otherwise we could extend the type
    // For now, we'll use 'FUNCTION' for all exams and store the actual type in the answers
    const formType: 'FUNCTION' = 'FUNCTION';

    // Insert into consultation_forms
    const { data, error } = await supabase
      .from('consultation_forms')
      .insert({
        user_id: userId,
        form_type: formType,
        answers,
        observations,
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error saving exam to consultation_forms:', error);
      return { success: false, error: error.message };
    }

    logger.log('✅ Exam saved to consultation_forms:', {
      formId: data?.id,
      examType: finalExamType,
      fieldsCount: answers.length
    });

    return { success: true, formId: data?.id };
  } catch (error: any) {
    logger.error('Error in saveExamToConsultationForms:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Actualiza el pilar FUNCTION con los datos extraídos del examen
 * Usa la misma estructura que normalizeAnswersToPillar para mantener consistencia
 */
export async function saveFunctionFromExam(
  userId: string,
  parsedData: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const pillarData: Partial<PillarFunction> = {};

    // Panel hormonal
    const hormonal_panel: Record<string, any> = {};
    Object.entries(parsedData).forEach(([key, value]) => {
      if (
        key.startsWith('function_fsh') ||
        key.startsWith('function_lh') ||
        key.startsWith('function_estradiol') ||
        key.startsWith('function_prolactina') ||
        key.startsWith('function_tsh') ||
        key.startsWith('function_t4') ||
        key.startsWith('function_cycle_day')
      ) {
        hormonal_panel[key] = value;
      }
    });
    if (Object.keys(hormonal_panel).length > 0) {
      pillarData.hormonal_panel = hormonal_panel;
    }

    // Panel metabólico
    const metabolic_panel: Record<string, any> = {};
    Object.entries(parsedData).forEach(([key, value]) => {
      if (
        key.startsWith('function_glucosa') ||
        key.startsWith('function_insulina') ||
        key.startsWith('function_hemograma') ||
        key.startsWith('function_ferritina') ||
        key.startsWith('function_hierro') ||
        key.startsWith('function_transferrina') ||
        key.startsWith('function_saturacion') ||
        key.startsWith('function_pcr') ||
        key.startsWith('function_colesterol') ||
        key.startsWith('function_trigliceridos')
      ) {
        metabolic_panel[key] = value;
      }
    });
    if (Object.keys(metabolic_panel).length > 0) {
      pillarData.metabolic_panel = metabolic_panel;
    }

    // Vitamina D
    const vitamin_d: Record<string, any> = {};
    Object.entries(parsedData).forEach(([key, value]) => {
      if (key.startsWith('function_vitamina_d')) {
        vitamin_d[key] = value;
      }
    });
    if (Object.keys(vitamin_d).length > 0) {
      pillarData.vitamin_d = vitamin_d;
    }

    // No guardar si no hay nada relevante
    if (Object.keys(pillarData).length === 0) {
      logger.warn('No FUNCTION pillar data to save from exam');
      return { success: false, error: 'No hay datos de función para guardar' };
    }

    pillarData.user_id = userId;

    const { error } = await supabase
      .from('pillar_function')
      .upsert(pillarData, { onConflict: 'user_id' });

    if (error) {
      logger.error('Error saving FUNCTION pillar from exam:', error);
      return { success: false, error: error.message };
    }

    logger.log('✅ FUNCTION pillar updated from exam', {
      userId,
      keys: Object.keys(parsedData)
    });

    return { success: true };
  } catch (error: any) {
    logger.error('Error in saveFunctionFromExam:', error);
    return { success: false, error: error.message };
  }
}

