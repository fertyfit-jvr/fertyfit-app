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
  rawText?: string
): Promise<{ success: boolean; error?: string; formId?: number }> {
  try {
    // Convert parsed data to FormAnswer format
    const finalExamType = examTypeDetected || examType || 'unknown';
    const answers = convertParsedDataToFormAnswers(parsedData, finalExamType);

    if (answers.length === 0) {
      logger.warn('No data to save from exam');
      return { success: false, error: 'No se encontraron datos para guardar' };
    }

    // Add raw text as observation if provided
    let observations = '';
    if (rawText) {
      observations = `Texto extraído del examen:\n${rawText.substring(0, 1000)}${rawText.length > 1000 ? '...' : ''}`;
    }

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
        answers: answers,
        observations: observations,
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

