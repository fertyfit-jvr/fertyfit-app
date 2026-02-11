/**
 * reportFormSerializer.ts
 * 
 * Serializa formularios de consulta (F0, FUNCTION, FOOD, FLORA, FLOW)
 * a una estructura normalizada para usar en informes HTML.
 */

import type { ConsultationForm, FormAnswer } from '../types.js';
import { FORM_DEFINITIONS } from '../constants/formDefinitions.js';

export type NormalizedQuestion = {
  questionId: string;
  questionText: string;
  answer: string;
  category?: string;
};

export type SerializedForms = {
  F0?: NormalizedQuestion[];
  FUNCTION?: NormalizedQuestion[];
  FOOD?: NormalizedQuestion[];
  FLORA?: NormalizedQuestion[];
  FLOW?: NormalizedQuestion[];
};

/**
 * Formatea una respuesta a string legible
 */
function formatAnswer(answer: string | number | boolean | string[] | Record<string, any> | undefined): string {
  if (answer === undefined || answer === null) return '—';
  if (typeof answer === 'boolean') return answer ? 'Sí' : 'No';
  if (Array.isArray(answer)) {
    if (answer.length === 0) return 'Ninguno';
    return answer.join(', ');
  }
  if (typeof answer === 'number') return answer.toString();
  if (typeof answer === 'string') {
    if (!answer.trim()) return '—';
    return answer;
  }
  if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
    return JSON.stringify(answer);
  }
  return String(answer);
}

/**
 * Resuelve el texto de la pregunta desde FORM_DEFINITIONS
 */
function getQuestionText(formType: string, questionId: string): string {
  // Intentar buscar en FORM_DEFINITIONS[formType]
  const formDef = (FORM_DEFINITIONS as any)[formType];

  if (!formDef) return questionId; // Fallback al ID si no hay definición

  // Para F0: es un array plano de preguntas
  if (formType === 'F0' && Array.isArray(formDef)) {
    const q = formDef.find((item: any) => item.id === questionId);
    return q?.text || questionId;
  }

  // Para pilares: buscar en las preguntas del array
  if (Array.isArray(formDef)) {
    const q = formDef.find((item: any) => item.id === questionId);
    return q?.text || questionId;
  }

  return questionId;
}

/**
 * Serializa formularios de consulta para el informe BASIC
 */
export function serializeFormsForBasicReport(forms: ConsultationForm[]): SerializedForms {
  const result: SerializedForms = {};

  const formTypes: Array<'F0' | 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW'> = [
    'F0',
    'FUNCTION',
    'FOOD',
    'FLORA',
    'FLOW',
  ];

  for (const formType of formTypes) {
    const form = forms.find((f) => f.form_type === formType);
    if (!form || !form.answers || form.answers.length === 0) {
      result[formType] = undefined;
      continue;
    }

    const normalized: NormalizedQuestion[] = form.answers.map((ans: FormAnswer) => {
      return {
        questionId: ans.questionId,
        questionText: getQuestionText(formType, ans.questionId),
        answer: formatAnswer(ans.answer),
        category: undefined, // Se puede extender si necesitas categorías internas
      };
    });

    result[formType] = normalized;
  }

  return result;
}
