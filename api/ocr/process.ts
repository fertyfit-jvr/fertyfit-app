/**
 * Vercel Serverless Function
 * API Route para OCR con Google Cloud Vision
 * POST /api/ocr/process
 * 
 * Security: Rate limiting, input validation, image validation, error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OCRRequestSchema } from '../../server/lib/validation.js';
import { ocrRateLimiter, rateLimitMiddleware } from '../../server/lib/rateLimiter.js';
import { sendErrorResponse, createError } from '../../server/lib/errorHandler.js';
import { applySecurityHeaders, validateImageUpload } from '../../server/lib/security.js';
import { validateExtractedData, getErrorMessage } from '../../server/lib/medicalValidation.js';
import { ai } from '../../server/lib/ai.js';
import { logger } from '../../server/lib/logger.js';

// Extracción estructurada con Gemini 2.5 Flash
async function extractStructuredDataWithGemini(
  base64Image: string,
  examType?: string
) {
  const prompt = examType 
    ? `
Eres un experto en análisis de exámenes médicos especializado en fertilidad y salud reproductiva.

Analiza esta imagen de un examen médico de tipo "${examType}".

La imagen puede ser:
- Una tabla de resultados de laboratorio (analíticas)
- Una imagen real de ecografía transvaginal o abdominal
- Un informe médico con texto estructurado
- Cualquier otro tipo de examen médico relacionado con fertilidad

INSTRUCCIONES:
1. Si es una tabla de texto: Extrae todos los parámetros, valores, unidades y rangos de referencia.
2. Si es una imagen de ecografía: Analiza las estructuras visibles, medidas, características morfológicas, y cualquier texto o anotaciones presentes. 
   IMPORTANTE: Para ecografías, puedes devolver un array vacío en "resultados" si no hay parámetros numéricos estructurados, pero SIEMPRE debes incluir una descripción detallada en "hallazgos_visuales".
3. Si es otro tipo de examen: Extrae toda la información estructurada disponible.

DEVUELVE UN ÚNICO OBJETO JSON con la forma:
{
  "tipo_examen": "${examType}",
  "resultados": [
    {
      "parametro": string,
      "valor": number | string,
      "unidades": string | null,
      "rango_referencia": string | null,
      "observaciones": string | null
    }
  ],
  "hallazgos_visuales": string | null
}

IMPORTANTE: Si es una ecografía y no hay parámetros numéricos estructurados, devuelve "resultados": [] pero describe todo en "hallazgos_visuales".

No añadas nada fuera del JSON (ni explicaciones, ni texto adicional).`
    : `
Eres un experto en análisis de exámenes médicos especializado en fertilidad y salud reproductiva.

Analiza esta imagen de un examen médico y:

1. PRIMERO identifica el tipo de examen:
   - Tipos comunes: "hormonal", "metabolic", "vitamin_d", "ecografia", "hsg", "espermio"
   - Pero puede ser CUALQUIER otro tipo de examen médico (ej: "hemograma", "coagulacion", "tiroides_completo", "vitamina_b12", "testosterona", etc.)
   - Si es una imagen de ecografía (ultrasonido), identifícala como "ecografia"
   - Si no está seguro, usa un nombre descriptivo basado en lo que ve

2. LUEGO extrae toda la información disponible:
   - Si es una tabla de texto: parámetros, valores, unidades, rangos
   - Si es una imagen de ecografía: estructuras visibles, medidas, características, texto/anotaciones. 
     IMPORTANTE: Para ecografías, puedes devolver "resultados": [] si no hay parámetros numéricos estructurados, pero SIEMPRE debes incluir una descripción detallada en "hallazgos_visuales".
   - Si es otro tipo: toda la información estructurada que encuentres

DEVUELVE UN ÚNICO OBJETO JSON con la forma:
{
  "tipo_examen": string,
  "resultados": [
    {
      "parametro": string,
      "valor": number | string,
      "unidades": string | null,
      "rango_referencia": string | null,
      "observaciones": string | null
    }
  ],
  "hallazgos_visuales": string | null
}

IMPORTANTE: Si es una ecografía y no hay parámetros numéricos estructurados, devuelve "resultados": [] pero describe todo en "hallazgos_visuales".

No añadas nada fuera del JSON (ni explicaciones, ni texto adicional).`;

  // Detectar tipo MIME de la imagen
  let mimeType = 'image/jpeg'; // Default
  if (base64Image.startsWith('/9j/') || base64Image.startsWith('iVBORw0KG')) {
    mimeType = 'image/jpeg';
  } else if (base64Image.startsWith('iVBORw0KG')) {
    mimeType = 'image/png';
  } else if (base64Image.startsWith('UklGR')) {
    mimeType = 'image/webp';
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { text: prompt },
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  } as any);

  // Validar y extraer texto de respuesta de forma segura
  let jsonText: string;
  if (response && typeof response === 'object') {
    // Intentar acceder a .text de forma segura
    const responseText = (response as { text?: string }).text;
    if (typeof responseText === 'string' && responseText.length > 0) {
      jsonText = responseText;
    } else {
      // Fallback: intentar stringify si no hay .text
      jsonText = JSON.stringify(response);
    }
  } else {
    throw new Error('Respuesta inválida de Gemini: formato desconocido');
  }

  // Validar y parsear JSON de forma segura
  try {
    const parsed = JSON.parse(jsonText);
    
    // Validar estructura mínima esperada (permitir campos adicionales para RAG)
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Respuesta de Gemini no es un objeto JSON válido');
    }
    
    // Si tiene resultados, validar que sea un array (pero permitir otros campos)
    if (parsed.resultados !== undefined && !Array.isArray(parsed.resultados)) {
      logger.warn('Gemini response: resultados no es un array, convirtiendo a array vacío');
      parsed.resultados = [];
    }
    
    // Extraer tipo detectado (puede ser cualquier string)
    const detectedType = parsed.tipo_examen || examType || 'examen_medico';
    
    return {
      ...parsed,
      examTypeDetected: detectedType
    };
  } catch (parseError) {
    logger.error('Error parsing Gemini JSON response:', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      jsonTextLength: jsonText.length,
      jsonTextPreview: jsonText.substring(0, 200),
    });
    throw new Error('Error al procesar respuesta del servidor: formato JSON inválido');
  }
}

// Helper function to set CORS headers
function setCORSHeaders(res: VercelResponse, origin: string): string {
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0');
  const allowedOrigins = [
    'https://method.fertyfit.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
  ];
  
  let allowedOrigin: string;
  if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
  } else if (isLocalhost) {
    allowedOrigin = origin;
  } else {
    allowedOrigin = 'https://method.fertyfit.com';
  }
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  
  return allowedOrigin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS FIRST - before anything else
  const origin = req.headers.origin || '';
  const allowedOrigin = setCORSHeaders(res, origin);

  // Handle preflight OPTIONS - return immediately with CORS headers ONLY
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.setHeader('Content-Length', '0');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
    return res.end();
  }

  // Wrap everything else in try-catch to ensure JSON responses always
  try {
    logger.log('CORS Debug:', { origin, allowedOrigin, method: req.method });

    // Apply security headers AFTER CORS
    applySecurityHeaders(res);
    
    // Re-assert CORS headers after security headers to ensure they're not overwritten
    setCORSHeaders(res, origin);

    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting (stricter for OCR as it's more expensive)
    const rateLimit = rateLimitMiddleware(ocrRateLimiter, req, res);
    if (!rateLimit.allowed) {
      Object.entries(rateLimit.headers || {}).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      return res.status(429).json({
        error: 'Demasiadas solicitudes de OCR. Por favor, intenta de nuevo en un momento.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }
    Object.entries(rateLimit.headers || {}).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Validate input
    const validatedData = OCRRequestSchema.parse(req.body);
    const { image, examType } = validatedData;

    // Validate and sanitize image
    const imageValidation = validateImageUpload(image, 5000); // Max 5MB
    if (!imageValidation.valid) {
      throw createError(
        imageValidation.error || getErrorMessage('INVALID_IMAGE', examType || 'examen_medico'),
        400,
        'INVALID_IMAGE'
      );
    }

    const sanitizedImage = imageValidation.sanitized || image;

    // Extract base64 data (remove data URL prefix)
    const base64Data = sanitizedImage.split(',')[1];
    if (!base64Data) {
      throw createError('Invalid image format', 400, 'INVALID_IMAGE_FORMAT');
    }

    // Tamaño máximo 10MB (igual que antes, pero usando longitud de base64)
    const estimatedBytes = (base64Data.length * 3) / 4;
    if (estimatedBytes > 10 * 1024 * 1024) {
      throw createError(getErrorMessage('IMAGE_TOO_LARGE', examType || 'examen_medico'), 400, 'IMAGE_TOO_LARGE');
    }

    // Llamar a Gemini para extracción estructurada
    let structuredData: any;
    try {
      structuredData = await extractStructuredDataWithGemini(base64Data, examType);
    } catch (ocrError: any) {
      logger.error('Gemini OCR Error:', {
        message: ocrError instanceof Error ? ocrError.message : String(ocrError),
        stack: ocrError instanceof Error ? ocrError.stack : undefined,
        examType: examType || 'auto-detect',
      });
      // Reusar mensaje de timeout o genérico según convenga
      throw createError(
        getErrorMessage('TIMEOUT_ERROR', examType || 'examen_medico'),
        504,
        'TIMEOUT_ERROR'
      );
    }

    // Extraer tipo detectado
    const examTypeDetected = structuredData.examTypeDetected || structuredData.tipo_examen || examType || 'examen_medico';
    
    // Mapeamos el JSON de Gemini a un objeto de campos numéricos
    const rawParsedData: Record<string, any> = {};
    const resultados = Array.isArray(structuredData?.resultados)
      ? structuredData.resultados
      : [];
    const hallazgosVisuales = structuredData?.hallazgos_visuales || null;

    // Tipos conocidos que tienen validación de rangos médicos
    const knownExamTypes = ['hormonal', 'metabolic', 'vitamin_d', 'espermio'];
    const isKnownType = knownExamTypes.includes(examTypeDetected.toLowerCase());

    // Tipos de examen que son principalmente visuales (no requieren resultados estructurados)
    const visualExamTypes = ['ecografia', 'hsg', 'ultrasonido', 'ecografía'];
    const isVisualExam = visualExamTypes.some(type => 
      examTypeDetected.toLowerCase().includes(type.toLowerCase())
    );

    // Solo validar "no es examen médico" para tipos conocidos de laboratorio
    // NO rechazar ecografías aunque no tengan resultados estructurados
    const labExamTypes = ['hormonal', 'metabolic', 'vitamin_d', 'espermio'];
    if (labExamTypes.includes(examTypeDetected.toLowerCase()) && (!resultados || resultados.length === 0)) {
      throw createError(getErrorMessage('NO_MEDICAL_EXAM', examTypeDetected), 400, 'NO_MEDICAL_EXAM');
    }

    // Para ecografías y exámenes visuales, aceptar aunque no haya resultados estructurados
    // siempre que haya hallazgos_visuales o tipo_examen detectado
    if (isVisualExam && (!resultados || resultados.length === 0) && !hallazgosVisuales) {
      // Si es ecografía pero no hay hallazgos visuales ni resultados, puede ser que Gemini no pudo analizarla
      // En este caso, aceptamos igualmente pero con advertencia
      logger.warn('Ecografía detectada sin resultados estructurados ni hallazgos visuales, aceptando igualmente');
    }

    if (isKnownType) {
      // SOLO para tipos conocidos: mapear a keys específicas para validación
      for (const item of resultados) {
        // Validar estructura del item antes de procesar
        if (!item || typeof item !== 'object') {
          logger.warn('Item inválido en resultados de Gemini, saltando:', item);
          continue;
        }

        // Validar y extraer parametro de forma segura
        const parametroRaw = item.parametro;
        if (parametroRaw === undefined || parametroRaw === null) {
          logger.warn('Item sin parametro, saltando:', item);
          continue;
        }
        const parametro = String(parametroRaw).toLowerCase().trim();
        if (parametro.length === 0) {
          logger.warn('Item con parametro vacío, saltando:', item);
          continue;
        }

        // Validar y extraer valor (puede ser number o string)
        const valor = item.valor;
        if (valor === undefined || valor === null) {
          logger.warn(`Item sin valor para parametro "${parametro}", saltando:`, item);
          continue;
        }

        // Mapear nombres de parámetro a keys internas usadas en MEDICAL_RANGES
        if (parametro.includes('fsh')) rawParsedData.function_fsh = valor;
        if (parametro.includes('lh')) rawParsedData.function_lh = valor;
        if (parametro.includes('estradiol')) rawParsedData.function_estradiol = valor;
        if (parametro.includes('prolact')) rawParsedData.function_prolactina = valor;
        if (parametro.includes('tsh')) rawParsedData.function_tsh = valor;
        if (parametro.includes('t4')) rawParsedData.function_t4 = valor;
        if (parametro.includes('glucosa')) rawParsedData.function_glucosa = valor;
        if (parametro.includes('insulin')) rawParsedData.function_insulina = valor;
        if (parametro.includes('ferritin')) rawParsedData.function_ferritina = valor;
        if (parametro.includes('hierro')) rawParsedData.function_hierro = valor;
        if (parametro.includes('transferrin')) rawParsedData.function_transferrina = valor;
        if (parametro.includes('colesterol')) rawParsedData.function_colesterol = valor;
        if (parametro.includes('triglic')) rawParsedData.function_trigliceridos = valor;
        if (parametro.includes('vitamina d') || parametro.includes('25-oh') || parametro.includes('25oh')) {
          rawParsedData.function_vitamina_d_valor = valor;
        }
        if (parametro.includes('afc total')) rawParsedData.function_afc_total = valor;
        if (parametro.includes('afc der')) rawParsedData.function_afc_derecho = valor;
        if (parametro.includes('afc izq')) rawParsedData.function_afc_izquierdo = valor;
        if (parametro.includes('endometrio')) rawParsedData.function_endometrio = valor;
        if (parametro.includes('volumen') && examTypeDetected.toLowerCase() === 'espermio') {
          rawParsedData.function_espermio_volumen = valor;
        }
        if (parametro.includes('concentración') || parametro.includes('concentracion')) {
          rawParsedData.function_espermio_concentracion = valor;
        }
        if (parametro.includes('movilidad total')) {
          rawParsedData.function_espermio_mov_total = valor;
        }
        if (parametro.includes('movilidad progresiva')) {
          rawParsedData.function_espermio_mov_prog = valor;
        }
        if (parametro.includes('morfolog')) {
          rawParsedData.function_espermio_morfologia = valor;
        }
        if (parametro.includes('vitalidad')) {
          rawParsedData.function_espermio_vitalidad = valor;
        }
      }
    } else {
      // Para tipos desconocidos: guardar TAL CUAL viene de Gemini
      for (const item of resultados) {
        if (!item || typeof item !== 'object' || !item.parametro) {
          logger.warn('Item inválido en resultados de Gemini, saltando:', item);
          continue;
        }

        const parametro = String(item.parametro).trim();
        const valor = item.valor;

        if (valor === undefined || valor === null) {
          continue;
        }

        // Guardar directamente con el nombre que viene de Gemini
        // Normalizar solo espacios y caracteres especiales para la key
        const normalizedKey = parametro
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        
        rawParsedData[normalizedKey] = valor;
        
        // También guardar con el nombre original para referencia
        rawParsedData[`${normalizedKey}_original`] = parametro;
      }
    }

    // Agregar hallazgos_visuales si existe (para ecografías)
    if (hallazgosVisuales) {
      rawParsedData['hallazgos_visuales'] = hallazgosVisuales;
    }

    // También guardar el tipo de examen detectado
    rawParsedData['tipo_examen_detectado'] = examTypeDetected;

    // Validar los datos extraídos solo para tipos conocidos
    let dataValidation;
    if (isKnownType) {
      try {
        dataValidation = validateExtractedData(rawParsedData, examTypeDetected as any);
      } catch (validationError: any) {
        logger.error('Error validating data:', validationError);
        dataValidation = {
          isValid: true,
          warnings: ['Algunos valores no pudieron ser validados. Por favor, revísalos manualmente.'],
          errors: [],
          validatedData: rawParsedData,
        };
      }
    } else {
      // Para tipos desconocidos, aceptar todo sin validación estricta
      dataValidation = {
        isValid: true,
        warnings: [],
        errors: [],
        validatedData: rawParsedData,
      };
    }

    return res.status(200).json({
      parsedData: dataValidation.validatedData,
      warnings: dataValidation.warnings,
      errors: dataValidation.errors,
      raw: structuredData,
      examTypeDetected: examTypeDetected,
    });
  } catch (error) {
    // Log error details for debugging
    logger.error('OCR API Error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body ? { examType: req.body.examType, hasImage: !!req.body.image } : undefined,
    });
    
    // Ensure CORS headers are set before sending error response
    const origin = req.headers.origin || '';
    setCORSHeaders(res, origin);
    
    sendErrorResponse(res, error, req);
  }
}

