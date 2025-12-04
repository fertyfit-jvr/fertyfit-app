/**
 * Medical Validation
 * Validaciones para exámenes médicos y rangos de valores
 */

export interface MedicalRange {
  min: number;
  max: number;
  recommendedMin?: number;
  recommendedMax?: number;
  unit: string;
}

export interface ValidationResult {
  isValid: boolean;
  isMedicalExam: boolean;
  warnings: string[];
  errors: string[];
  confidence: number; // 0-1, qué tan seguro estamos de que es un examen médico
}

/**
 * Términos médicos que deben aparecer en cada tipo de examen
 */
const MEDICAL_TERMS_BY_EXAM_TYPE: Record<string, string[]> = {
  hormonal: [
    'fsh', 'lh', 'estradiol', 'prolactina', 'tsh', 't4',
    'hormona', 'hormonal', 'panel hormonal', 'día del ciclo',
    'mUI/mL', 'pg/mL', 'ng/mL', 'µUI/mL', 'ng/dL'
  ],
  metabolic: [
    'glucosa', 'insulina', 'ferritina', 'hierro', 'transferrina',
    'colesterol', 'triglicéridos', 'pcr', 'metabólico', 'metabolismo',
    'mg/dL', 'µUI/mL', 'ng/mL', 'µg/dL', 'mg/L'
  ],
  vitamin_d: [
    'vitamina d', '25-oh', '25oh', 'calcifediol', 'colecalciferol',
    'ng/mL', 'nmol/L', 'deficiencia', 'insuficiencia'
  ],
  ecografia: [
    'ecografía', 'ecografia', 'ultrasonido', 'ultrasonografía',
    'afc', 'recuento folicular', 'folículos', 'endometrio',
    'ovario', 'útero', 'mm', 'cm'
  ],
  hsg: [
    'histerosalpingografía', 'hsg', 'trompas', 'útero', 'contraste',
    'permeabilidad', 'obstrucción', 'patente'
  ],
  espermio: [
    'espermiograma', 'semen', 'espermatozoides', 'concentración',
    'movilidad', 'morfología', 'vitalidad', 'volumen',
    'millones/mL', 'mL', '%'
  ],
};

/**
 * Rangos médicos válidos por campo
 */
export const MEDICAL_RANGES: Record<string, MedicalRange> = {
  // Panel Hormonal
  function_fsh: { min: 0, max: 40, recommendedMin: 3, recommendedMax: 10, unit: 'mUI/mL' },
  function_lh: { min: 0, max: 40, recommendedMin: 2, recommendedMax: 8, unit: 'mUI/mL' },
  function_estradiol: { min: 0, max: 1000, recommendedMin: 30, recommendedMax: 100, unit: 'pg/mL' },
  function_prolactina: { min: 0, max: 100, recommendedMin: 5, recommendedMax: 25, unit: 'ng/mL' },
  function_tsh: { min: 0, max: 10, recommendedMin: 0.5, recommendedMax: 2.5, unit: 'µUI/mL' },
  function_t4: { min: 0, max: 5, recommendedMin: 0.8, recommendedMax: 1.8, unit: 'ng/dL' },
  function_cycle_day: { min: 1, max: 40, recommendedMin: 1, recommendedMax: 5, unit: 'día' },
  
  // Panel Metabólico
  function_glucosa: { min: 40, max: 300, recommendedMin: 70, recommendedMax: 100, unit: 'mg/dL' },
  function_insulina: { min: 0, max: 100, recommendedMin: 2, recommendedMax: 25, unit: 'µUI/mL' },
  function_ferritina: { min: 1, max: 500, recommendedMin: 40, recommendedMax: 150, unit: 'ng/mL' },
  function_hierro: { min: 0, max: 300, recommendedMin: 50, recommendedMax: 170, unit: 'µg/dL' },
  function_transferrina: { min: 0, max: 600, recommendedMin: 200, recommendedMax: 400, unit: 'mg/dL' },
  function_saturacion: { min: 0, max: 100, recommendedMin: 20, recommendedMax: 50, unit: '%' },
  function_pcr: { min: 0, max: 20, recommendedMin: 0, recommendedMax: 1, unit: 'mg/L' },
  function_colesterol: { min: 0, max: 400, recommendedMin: 0, recommendedMax: 200, unit: 'mg/dL' },
  function_trigliceridos: { min: 0, max: 500, recommendedMin: 0, recommendedMax: 150, unit: 'mg/dL' },
  
  // Vitamina D
  function_vitamina_d_valor: { min: 1, max: 150, recommendedMin: 30, recommendedMax: 60, unit: 'ng/mL' },
  
  // Ecografía
  function_afc_total: { min: 0, max: 50, recommendedMin: 5, recommendedMax: 20, unit: 'folículos' },
  function_afc_derecho: { min: 0, max: 50, recommendedMin: 2, recommendedMax: 10, unit: 'folículos' },
  function_afc_izquierdo: { min: 0, max: 50, recommendedMin: 2, recommendedMax: 10, unit: 'folículos' },
  function_endometrio: { min: 1, max: 20, recommendedMin: 5, recommendedMax: 12, unit: 'mm' },
  
  // Espermiograma
  function_espermio_volumen: { min: 0, max: 10, recommendedMin: 1.5, recommendedMax: 5, unit: 'mL' },
  function_espermio_concentracion: { min: 0, max: 300, recommendedMin: 15, recommendedMax: 200, unit: 'millones/mL' },
  function_espermio_mov_total: { min: 0, max: 100, recommendedMin: 40, recommendedMax: 100, unit: '%' },
  function_espermio_mov_prog: { min: 0, max: 100, recommendedMin: 32, recommendedMax: 100, unit: '%' },
  function_espermio_morfologia: { min: 0, max: 100, recommendedMin: 4, recommendedMax: 100, unit: '%' },
  function_espermio_vitalidad: { min: 0, max: 100, recommendedMin: 58, recommendedMax: 100, unit: '%' },
};

/**
 * Valida si un texto parece ser un examen médico del tipo especificado
 */
export function validateMedicalExamText(
  text: string,
  examType: 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio'
): ValidationResult {
  const normalizedText = text.toLowerCase();
  const terms = MEDICAL_TERMS_BY_EXAM_TYPE[examType] || [];
  
  let matches = 0;
  const foundTerms: string[] = [];
  
  for (const term of terms) {
    if (normalizedText.includes(term.toLowerCase())) {
      matches++;
      foundTerms.push(term);
    }
  }
  
  // Calcular confianza: al menos 3 términos médicos = examen válido
  const confidence = Math.min(1, matches / Math.max(3, terms.length * 0.3));
  const isMedicalExam = matches >= 3;
  
  const warnings: string[] = [];
  const errors: string[] = [];
  
  if (!isMedicalExam) {
    errors.push(
      `No se detectaron suficientes términos médicos para un ${examType === 'hormonal' ? 'panel hormonal' : 
        examType === 'metabolic' ? 'panel metabólico' : 
        examType === 'vitamin_d' ? 'análisis de Vitamina D' :
        examType === 'ecografia' ? 'ecografía' :
        examType === 'hsg' ? 'histerosalpingografía' : 'espermiograma'}. ` +
      `Por favor, asegúrate de que la imagen sea un examen médico válido.`
    );
  } else if (confidence < 0.5) {
    warnings.push(
      `Confianza baja en la detección. Se encontraron ${matches} términos médicos. ` +
      `Revisa que la imagen sea clara y completa.`
    );
  }
  
  return {
    isValid: isMedicalExam,
    isMedicalExam,
    warnings,
    errors,
    confidence,
  };
}

/**
 * Valida un valor médico contra su rango esperado
 */
export function validateMedicalValue(
  fieldId: string,
  value: number | null | undefined
): { isValid: boolean; warning?: string; error?: string } {
  if (value === null || value === undefined) {
    return { isValid: true }; // Valores opcionales son válidos
  }
  
  const range = MEDICAL_RANGES[fieldId];
  if (!range) {
    return { isValid: true }; // Si no hay rango definido, asumimos válido
  }
  
  // Validar rango absoluto
  if (value < range.min || value > range.max) {
    return {
      isValid: false,
      error: `${fieldId.replace('function_', '')}: ${value} ${range.unit} está fuera del rango válido (${range.min}-${range.max} ${range.unit}). Por favor, verifica el valor.`,
    };
  }
  
  // Advertir si está fuera del rango recomendado
  if (range.recommendedMin !== undefined && range.recommendedMax !== undefined) {
    if (value < range.recommendedMin || value > range.recommendedMax) {
      return {
        isValid: true,
        warning: `${fieldId.replace('function_', '')}: ${value} ${range.unit} está fuera del rango recomendado (${range.recommendedMin}-${range.recommendedMax} ${range.unit}). Revisa si el valor es correcto.`,
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Valida todos los valores extraídos de un examen
 */
export function validateExtractedData(
  data: Record<string, any>,
  examType: 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio'
): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  validatedData: Record<string, any>;
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const validatedData: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') {
      continue; // Saltar valores vacíos
    }
    
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue)) {
      continue; // Saltar valores no numéricos
    }
    
    const validation = validateMedicalValue(key, numValue);
    
    if (!validation.isValid) {
      errors.push(validation.error || '');
      // No incluimos valores inválidos en validatedData
    } else {
      validatedData[key] = numValue;
      if (validation.warning) {
        warnings.push(validation.warning);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    validatedData,
  };
}

/**
 * Genera mensajes de error amigables para el usuario
 */
export function getErrorMessage(errorCode: string, examType: string): string {
  const examTypeLabel = {
    hormonal: 'panel hormonal',
    metabolic: 'panel metabólico',
    vitamin_d: 'análisis de Vitamina D',
    ecografia: 'ecografía',
    hsg: 'histerosalpingografía',
    espermio: 'espermiograma',
  }[examType] || 'examen médico';
  
  const messages: Record<string, string> = {
    NO_TEXT_DETECTED: `No se detectó texto en la imagen. Asegúrate de que:\n• La imagen esté enfocada y nítida\n• Haya suficiente luz\n• El texto sea legible\n• La imagen sea del ${examTypeLabel} completo`,
    INSUFFICIENT_TEXT: `Se detectó muy poco texto. Por favor:\n• Toma una foto más completa del ${examTypeLabel}\n• Asegúrate de que todos los valores sean visibles\n• Verifica que la imagen no esté borrosa`,
    INVALID_IMAGE: `La imagen no es válida. Por favor:\n• Usa formato JPEG, PNG o WebP\n• El tamaño máximo es 5MB\n• Asegúrate de que sea una imagen real`,
    IMAGE_TOO_LARGE: `La imagen es demasiado grande. El tamaño máximo es 5MB. Por favor, comprime la imagen o toma una foto con menor resolución.`,
    TIMEOUT_ERROR: `El procesamiento tardó demasiado. Por favor:\n• Intenta con una imagen más pequeña\n• Verifica tu conexión a internet\n• Vuelve a intentar en unos momentos`,
    CONFIG_ERROR: `Error de configuración del servidor. Por favor, contacta al soporte.`,
    NO_MEDICAL_EXAM: `La imagen no parece ser un ${examTypeLabel} válido. Por favor:\n• Asegúrate de fotografiar el examen médico completo\n• Verifica que sea el tipo de examen correcto\n• Intenta con otra foto más clara`,
  };
  
  return messages[errorCode] || `Error al procesar el ${examTypeLabel}. Por favor, intenta de nuevo.`;
}
