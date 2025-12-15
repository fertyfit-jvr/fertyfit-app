/**
 * Service for saving exam results to consultation_forms
 * Handles both predefined exam types and generic exams
 */

import { supabase } from './supabase';
import { logger } from '../lib/logger';
import { FormAnswer, ConsultationForm } from '../types';

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
  rawGeminiData?: any
): Promise<{ success: boolean; error?: string; formId?: number }> {
  try {
    // Convert parsed data to FormAnswer format
    const finalExamType = examTypeDetected || examType || 'unknown';
    const answers = convertParsedDataToFormAnswers(parsedData, finalExamType);

    if (answers.length === 0) {
      logger.warn('No data to save from exam');
      return { success: false, error: 'No se encontraron datos para guardar' };
    }

    // Construir observaciones con:
    // - Datos originales de Gemini (raw)
    // - Texto del examen (si existe)
    const observationsParts: string[] = [];

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
 * Appends an AI RAG analysis to an existing exam form as a new FormAnswer.
 * This keeps the exam values and the AI explanation together in consultation_forms.answers.
 */
export async function appendRagAnalysisToExam(
  formId: number,
  explanation: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('consultation_forms')
      .select('answers')
      .eq('id', formId)
      .single();

    if (error) {
      logger.error('Error fetching consultation_form for rag_analysis:', error);
      return { success: false, error: error.message };
    }

    const currentAnswers: FormAnswer[] = Array.isArray(data?.answers) ? data.answers : [];

    const updatedAnswers: FormAnswer[] = [
      ...currentAnswers.filter(a => a.questionId !== 'rag_analysis'),
      {
        questionId: 'rag_analysis',
        question: 'Análisis del examen generado por IA (FertyFit RAG)',
        answer: explanation,
      },
    ];

    const { error: updateError } = await supabase
      .from('consultation_forms')
      .update({
        answers: updatedAnswers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', formId);

    if (updateError) {
      logger.error('Error updating consultation_form with rag_analysis:', updateError);
      return { success: false, error: updateError.message };
    }

    logger.log('✅ RAG analysis appended to consultation_form', { formId });
    return { success: true };
  } catch (error: any) {
    logger.error('Error in appendRagAnalysisToExam:', error);
    return { success: false, error: error.message };
  }
}


