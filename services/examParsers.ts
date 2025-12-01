/**
 * Exam Parsers
 * Parsers inteligentes para extraer datos de exámenes médicos desde texto OCR
 * IGNORA datos personales (nombres, DNI, emails, direcciones, teléfonos)
 */

export interface ParsedExamData {
  [key: string]: any;
}

/**
 * Limpia el texto OCR eliminando datos personales
 */
function sanitizeText(text: string): string {
  let cleaned = text;

  // Eliminar DNI/NIE (formato español: 8 dígitos + letra o 8 dígitos)
  cleaned = cleaned.replace(/\b\d{8,9}[A-Z]?\b/gi, '');

  // Eliminar emails
  cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '');

  // Eliminar teléfonos (formato español: 9 dígitos, con o sin prefijo)
  cleaned = cleaned.replace(/\b(\+34|0034)?[\s-]?[6-9]\d{8}\b/g, '');

  // Eliminar direcciones comunes (calles, números, códigos postales)
  cleaned = cleaned.replace(/\b(calle|avenida|av\.|plaza|paseo|carretera)[\s\w,]+/gi, '');
  cleaned = cleaned.replace(/\b\d{5}\b/g, ''); // Códigos postales

  // Eliminar nombres comunes (patrones de nombres propios - solo si están claramente identificados)
  // Esto es más conservador, solo eliminamos si aparece "nombre:", "paciente:", etc.
  cleaned = cleaned.replace(/\b(nombre|paciente|nombre completo)[\s:]+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*/gi, '');

  // Eliminar fechas de nacimiento (formato DD/MM/YYYY o similar)
  cleaned = cleaned.replace(/\b(fecha de nacimiento|nacimiento|f\.n\.|f\.nac\.)[\s:]+[\d\/\-\.]+\b/gi, '');

  // Limpiar espacios múltiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Sanitiza un número asegurándose de que sea válido y esté en rango
 */
function sanitizeNumber(value: unknown, min?: number, max?: number): number | null {
  let num: number;
  
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    // Remove any non-numeric characters except decimal point and minus
    const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.');
    num = parseFloat(cleaned);
  } else {
    return null;
  }

  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  // Apply min/max constraints
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;

  return num;
}

/**
 * Busca un valor numérico después de una etiqueta en el texto
 * Versión mejorada: busca en un radio alrededor de la etiqueta para manejar tablas
 */
function findValueAfterLabel(
  text: string,
  labels: string[],
  options: {
    unit?: string;
    min?: number;
    max?: number;
    allowRange?: boolean;
    searchRadius?: number; // Radio de búsqueda en caracteres (default: 300)
  } = {}
): number | null {
  const searchRadius = options.searchRadius || 300; // Buscar hasta 300 caracteres después
  const normalizedText = text.toLowerCase();
  
  for (const label of labels) {
    const labelLower = label.toLowerCase();
    // Escape regex special characters
    const escapedLabel = labelLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Buscar la etiqueta (permitir espacios, guiones, dos puntos)
    // Ejemplo: "estradiol", "estradiol-e2", "estradiol sérico", "ESTRADIOL SÉRICO:"
    const labelPattern = escapedLabel.replace(/\s+/g, '[\\s\\-]*'); // Permitir espacios y guiones
    const labelRegex = new RegExp(`(${labelPattern})`, 'i');
    const labelMatch = text.match(labelRegex);
    
    if (!labelMatch || labelMatch.index === undefined) continue;
    
    // Extraer texto después de la etiqueta (hasta searchRadius caracteres)
    const startIndex = labelMatch.index + labelMatch[0].length;
    const textAfterLabel = text.substring(startIndex, startIndex + searchRadius);
    
    // Buscar número con unidades comunes (más flexible)
    // Patrones: número (con coma o punto) seguido opcionalmente de unidad
    const numberPatterns = [
      /([\d.,]+)\s*(?:mUI|pg|ng|uUI|U|mg|dl|ml|µUI|mIU)\s*\/\s*(?:ml|dl|L)/i, // Con unidad completa: "6,69 mUI/ml"
      /([\d.,]+)\s*(?:mUI|pg|ng|uUI|U|mg|dl|ml|µUI|mIU)/i, // Con unidad: "6,69 mUI"
      /([\d.,]+)(?:\s|$)/, // Solo número: "6,69"
    ];
    
    for (const pattern of numberPatterns) {
      const numberMatch = textAfterLabel.match(pattern);
      if (numberMatch && numberMatch[1]) {
        const value = sanitizeNumber(numberMatch[1], options.min, options.max);
        if (value !== null) {
          return value;
        }
      }
    }
  }
  
  return null;
}

/**
 * Parsea Panel Hormonal (Día 3)
 */
export function parseHormonalPanel(text: string): ParsedExamData {
  const data: ParsedExamData = {};

  // FSH - agregar más variaciones
  data.function_fsh = findValueAfterLabel(text, [
    'fsh',
    'hormona folículo estimulante',
    'fsh - hormona folículo estimulante',
    'hormona folículo-estimulante'
  ], {
    min: 0,
    max: 40,
    searchRadius: 400,
  });

  // LH - agregar más variaciones
  data.function_lh = findValueAfterLabel(text, [
    'lh',
    'hormona luteinizante',
    'lh - hormona luteinizante'
  ], {
    min: 0,
    max: 40,
    searchRadius: 400,
  });

  // Estradiol - agregar más variaciones comunes
  data.function_estradiol = findValueAfterLabel(text, [
    'estradiol sérico',
    'estradiol-e2',
    'estradiol - e2',
    'estradiol (e2)',
    'estradiol',
    'e2 sérico',
    'e2',
    'estradiol-e2 - sérico',
    'estradiol-e2 sérico'
  ], {
    min: 0,
    max: 1000,
    searchRadius: 400, // Buscar más lejos porque puede estar en otra columna
  });

  // Prolactina - agregar más variaciones
  data.function_prolactina = findValueAfterLabel(text, [
    'prolactina',
    'prl',
    'prolactina.'
  ], {
    min: 0,
    max: 100,
    searchRadius: 400,
  });

  // TSH - agregar más variaciones
  data.function_tsh = findValueAfterLabel(text, [
    'tsh',
    'hormona estimulante del tiroides',
    'tirotrofina',
    'tsh-tirotrofina',
    'tsh - tirotrofina'
  ], {
    min: 0,
    max: 10,
    searchRadius: 400,
  });

  // T4 libre - agregar más variaciones
  data.function_t4 = findValueAfterLabel(text, [
    't4 libre',
    't4',
    'tiroxina libre',
    't4-libre',
    't4 - libre',
    'tiroxina efectiva',
    'tiroxina efectiva - t4 - libre'
  ], {
    min: 0,
    max: 5,
    searchRadius: 400,
  });

  // Día del ciclo
  const cycleDayMatch = text.match(/(?:día|dia|day)[\s]*del[\s]*ciclo[\s:]*(\d+)/i) ||
                       text.match(/ciclo[\s:]*día[\s:]*(\d+)/i);
  if (cycleDayMatch) {
    const day = parseInt(cycleDayMatch[1]);
    if (day >= 1 && day <= 40) {
      data.function_cycle_day = day;
    }
  }

  return data;
}

/**
 * Parsea Panel Metabólico
 */
export function parseMetabolicPanel(text: string): ParsedExamData {
  const data: ParsedExamData = {};

  // Glucosa
  data.function_glucosa = findValueAfterLabel(text, ['glucosa', 'glucose'], {
    min: 40,
    max: 300,
  });

  // Insulina
  data.function_insulina = findValueAfterLabel(text, ['insulina', 'insulin'], {
    min: 0,
    max: 100,
  });

  // Ferritina
  data.function_ferritina = findValueAfterLabel(text, ['ferritina', 'ferritin'], {
    min: 1,
    max: 500,
  });

  // Hierro
  data.function_hierro = findValueAfterLabel(text, ['hierro', 'iron', 'fe'], {
    min: 0,
    max: 300,
  });

  // Transferrina
  data.function_transferrina = findValueAfterLabel(text, ['transferrina', 'transferrin'], {
    min: 0,
    max: 600,
  });

  // Saturación transferrina
  data.function_saturacion = findValueAfterLabel(text, ['saturación transferrina', 'sat. transferrina', 'saturation'], {
    min: 0,
    max: 100,
  });

  // PCR-us
  data.function_pcr = findValueAfterLabel(text, ['pcr-us', 'pcr', 'proteína c reactiva'], {
    min: 0,
    max: 20,
  });

  // Colesterol
  data.function_colesterol = findValueAfterLabel(text, ['colesterol total', 'colesterol', 'cholesterol'], {
    min: 0,
    max: 400,
  });

  // Triglicéridos
  data.function_trigliceridos = findValueAfterLabel(text, ['triglicéridos', 'trigliceridos', 'triglycerides'], {
    min: 0,
    max: 500,
  });

  return data;
}

/**
 * Parsea Vitamina D
 */
export function parseVitaminaD(text: string): ParsedExamData {
  const data: ParsedExamData = {};

  data.function_vitamina_d_valor = findValueAfterLabel(text, [
    'vitamina d',
    'vitamin d',
    '25-oh',
    '25oh',
    '25 oh',
    'calcifediol'
  ], {
    min: 1,
    max: 150,
  });

  return data;
}

/**
 * Parsea Ecografía Transvaginal + AFC
 */
export function parseEcografia(text: string): ParsedExamData {
  const data: ParsedExamData = {};

  // AFC total
  const afcTotalMatch = text.match(/(?:afc|recuento folicular)[\s]*(?:total)?[\s:]*(\d+)/i);
  if (afcTotalMatch) {
    const value = parseInt(afcTotalMatch[1]);
    if (value >= 0 && value <= 50) {
      data.function_afc_total = value;
    }
  }

  // AFC derecho
  const afcDerechoMatch = text.match(/(?:afc|recuento)[\s]*(?:derecho|derecha|right)[\s:]*(\d+)/i);
  if (afcDerechoMatch) {
    const value = parseInt(afcDerechoMatch[1]);
    if (value >= 0 && value <= 50) {
      data.function_afc_derecho = value;
    }
  }

  // AFC izquierdo
  const afcIzquierdoMatch = text.match(/(?:afc|recuento)[\s]*(?:izquierdo|izquierda|left)[\s:]*(\d+)/i);
  if (afcIzquierdoMatch) {
    const value = parseInt(afcIzquierdoMatch[1]);
    if (value >= 0 && value <= 50) {
      data.function_afc_izquierdo = value;
    }
  }

  // Endometrio
  data.function_endometrio = findValueAfterLabel(text, [
    'endometrio',
    'endometrial',
    'grosor endometrial',
    'espesor endometrial'
  ], {
    min: 1,
    max: 20,
  });

  return data;
}

/**
 * Parsea Histerosalpingografía (HSG)
 */
export function parseHSG(text: string): ParsedExamData {
  const data: ParsedExamData = {};

  // Permeabilidad derecha
  const derechaMatch = text.match(/(?:permeabilidad|trompa)[\s]*(?:derecha|derecho|right)[\s:]*([sí|si|yes|no])/i);
  if (derechaMatch) {
    data.function_hsg_derecha = derechaMatch[1].toLowerCase().includes('sí') || 
                                derechaMatch[1].toLowerCase().includes('si') ||
                                derechaMatch[1].toLowerCase().includes('yes') ? 'Sí' : 'No';
  }

  // Permeabilidad izquierda
  const izquierdaMatch = text.match(/(?:permeabilidad|trompa)[\s]*(?:izquierda|izquierdo|left)[\s:]*([sí|si|yes|no])/i);
  if (izquierdaMatch) {
    data.function_hsg_izquierda = izquierdaMatch[1].toLowerCase().includes('sí') || 
                                  izquierdaMatch[1].toLowerCase().includes('si') ||
                                  izquierdaMatch[1].toLowerCase().includes('yes') ? 'Sí' : 'No';
  }

  return data;
}

/**
 * Parsea Espermiograma
 */
export function parseEspermiograma(text: string): ParsedExamData {
  const data: ParsedExamData = {};

  // Volumen
  data.function_espermio_volumen = findValueAfterLabel(text, ['volumen', 'volume'], {
    min: 0,
    max: 10,
  });

  // Concentración
  data.function_espermio_concentracion = findValueAfterLabel(text, [
    'concentración',
    'concentracion',
    'concentration'
  ], {
    min: 0,
    max: 300,
  });

  // Movilidad total
  data.function_espermio_mov_total = findValueAfterLabel(text, [
    'movilidad total',
    'movilidad',
    'motility'
  ], {
    min: 0,
    max: 100,
  });

  // Movilidad progresiva
  data.function_espermio_mov_prog = findValueAfterLabel(text, [
    'movilidad progresiva',
    'progresiva',
    'progressive'
  ], {
    min: 0,
    max: 100,
  });

  // Morfología
  data.function_espermio_morfologia = findValueAfterLabel(text, [
    'morfología',
    'morfologia',
    'morphology'
  ], {
    min: 0,
    max: 100,
  });

  // Vitalidad
  data.function_espermio_vitalidad = findValueAfterLabel(text, [
    'vitalidad',
    'vitality'
  ], {
    min: 0,
    max: 100,
  });

  return data;
}

/**
 * Parsea un examen según su tipo
 * Limpia datos personales antes de parsear
 */
export function parseExam(text: string, examType: 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio'): ParsedExamData {
  // Limpiar datos personales antes de parsear
  const cleanedText = sanitizeText(text);
  
  switch (examType) {
    case 'hormonal':
      return parseHormonalPanel(cleanedText);
    case 'metabolic':
      return parseMetabolicPanel(cleanedText);
    case 'vitamin_d':
      return parseVitaminaD(cleanedText);
    case 'ecografia':
      return parseEcografia(cleanedText);
    case 'hsg':
      return parseHSG(cleanedText);
    case 'espermio':
      return parseEspermiograma(cleanedText);
    default:
      return {};
  }
}

