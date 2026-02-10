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
 * and optionally includes the AI RAG explanation directly in answers.
 */
export async function saveExamToConsultationForms(
  userId: string,
  parsedData: Record<string, any>,
  examType?: string,
  examTypeDetected?: string,
  rawText?: string,
  rawGeminiData?: any,
  ragExplanation?: string
): Promise<{ success: boolean; error?: string; formId?: number }> {
  try {
    // Convert parsed data to FormAnswer format
    const finalExamType = examTypeDetected || examType || 'unknown';
    const answers = convertParsedDataToFormAnswers(parsedData, finalExamType);

    // Optionally include the AI analysis as an extra answer
    if (ragExplanation && ragExplanation.trim().length > 0) {
      answers.push({
        questionId: 'rag_analysis',
        question: 'Análisis del examen generado por IA (FertyFit RAG)',
        answer: ragExplanation,
      });
    }

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

    // Exámenes médicos/analíticas: form_type EXAM (separado del pilar Function)
    const formType: 'EXAM' = 'EXAM';

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

    // Disparar generación automática de informe LABS
    // Esto se hace en segundo plano, no afecta el guardado del exam
    if (data?.id) {
      try {
        // Usar fetch para llamar al endpoint en segundo plano
        fetch('/api/analysis/report-extended', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            reportType: 'LABS',
            manualTrigger: false // Es automático
          })
        })
          .then(response => {
            if (response.ok) {
              logger.log('✅ LABS report triggered automatically for exam:', data.id);
            } else {
              logger.warn('⚠️ LABS report trigger failed for exam:', data.id);
            }
          })
          .catch(error => {
            logger.warn('⚠️ Error triggering LABS report:', error);
          });
      } catch (triggerError) {
        // No fallar el guardado del exam si falla el trigger del informe
        logger.warn('⚠️ Failed to trigger LABS report (non-blocking):', triggerError);
      }
    }

    return { success: true, formId: data?.id };
  } catch (error: any) {
    logger.error('Error in saveExamToConsultationForms:', error);
    return { success: false, error: error.message };
  }
}

