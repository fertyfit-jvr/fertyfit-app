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
  images: string[], // Array de imágenes base64
  examType?: string
) {
  const prompt = examType
    ? `
Eres un analista de datos médicos riguroso y preciso. TU OBJETIVO ES LA PRECISIÓN ABSOLUTA.

Analiza las imágenes proporcionadas de un examen médico de tipo "${examType}".
Las imágenes pueden corresponder a varias páginas del mismo documento o diferentes vistas del mismo examen.

REGLAS CRÍTICAS DE SEGURIDAD (ANTI-ALUCINACIONES):
1. **NO INVENTES NADA.** Si un valor no es claramente legible, IGNÓRALO. No adivines.
2. Si la imagen NO ES UN EXAMEN MÉDICO O CLÍNICO (ej: es una foto de una persona, paisaje, comida, ticket de compra, animal, etc.), DEBES RECHAZARLA.
   - En este caso, devuelve: \`{ "tipo_examen": "NO_MEDICO", "hallazgos_visuales": "Descripción corta de por qué no es médico (ej: Foto de un gato)", "resultados": [] }\`
3. Si es un examen médico, extrae SOLO lo que ves.

INSTRUCCIONES PARA EXÁMENES MÉDICOS:
1. Si es una tabla de texto: Extrae todos los parámetros, valores, unidades y rangos de referencia de TODAS las imágenes.
2. Si es una imagen de ecografía: Analiza las estructuras visibles, medidas, características morfológicas, y cualquier texto o anotaciones presentes. 
   IMPORTANTE: Para ecografías, puedes devolver un array vacío en "resultados" si no hay parámetros numéricos estructurados, pero SIEMPRE debes incluir una descripción detallada en "hallazgos_visuales".
3. Si es otro tipo de examen: Extrae toda la información estructurada disponible.

DEVUELVE UN ÚNICO OBJETO JSON con la forma:
{
  "tipo_examen": "${examType}" (o "NO_MEDICO" si aplica),
  "resultados": [
    {
      "parametro": string, // Nombre exacto como aparece
      "valor": number | string, // Valor exacto como aparece
      "unidades": string | null,
      "rango_referencia": string | null,
      "observaciones": string | null
    }
  ],
  "hallazgos_visuales": string | null
}

No añadas nada fuera del JSON.`
    : `
Eres un analista de datos médicos riguroso y preciso. TU OBJETIVO ES LA PRECISIÓN ABSOLUTA.

Analiza las imágenes proporcionadas y determina si constituyen un documento médico o una imagen clínica válida.

REGLAS CRÍTICAS DE SEGURIDAD (ANTI-ALUCINACIONES):
1. **VALIDACIÓN DE TIPO:**
   - Si la imagen NO es un documento médico (ej: selfie, paisaje, recibo, comida, mascota, meme), devuelve INMEDIATAMENTE:
     \`{ "tipo_examen": "NO_MEDICO", "resultados": [], "hallazgos_visuales": "Descripción de lo que ves (ej: Es una foto de una playa)" }\`
   - NO intentes extraer "datos médicos" de un ticket de compra o texto irrelevante.

2. **SI ES UN DOCUMENTO MÉDICO:**
   - Identifica el tipo de examen (considerando todas las imágenes).
   - Extrae SOLO los datos visibles y legibles. NO ADIVINES valores borrosos.
   - Si es una ecografía, céntrate en "hallazgos_visuales".

3. **EXTRACCIÓN:**
   - Tipos comunes: "hormonal", "metabolic", "vitamin_d", "ecografia", "hsg", "espermio".
   - Otros tipos: Usa un nombre descriptivo (ej: "hemograma_completo").

DEVUELVE UN ÚNICO OBJETO JSON con la forma:
{
  "tipo_examen": string (o "NO_MEDICO"),
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

No añadas nada fuera del JSON.`;

  // Preparar partes de imagen para Gemini
  const imageParts = images.map(base64Image => {
    // Detectar tipo MIME de la imagen
    let mimeType = 'image/jpeg'; // Default
    let cleanBase64 = base64Image;

    // Si viene con el prefijo data:image..., extraerlo y setear mimeType
    if (base64Image.includes(';base64,')) {
      const parts = base64Image.split(';base64,');
      const mimeMatch = parts[0].match(/:(.*?)$/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
      cleanBase64 = parts[1];
    } else {
      // Fallback detección básica si viene sin prefijo (legacy)
      if (base64Image.startsWith('/9j/') || base64Image.startsWith('iVBORw0KG')) {
        mimeType = 'image/jpeg';
      } else if (base64Image.startsWith('iVBORw0KG')) {
        mimeType = 'image/png';
      } else if (base64Image.startsWith('UklGR')) {
        mimeType = 'image/webp';
      }
    }

    return {
      inlineData: {
        data: cleanBase64,
        mimeType,
      },
    };
  });

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash', // Usando flash para velocidad, o 1.5-pro si se requiere más razonamiento
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...imageParts
        ]
      }
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1, // Baja temperatura para reducir alucinaciones y ser más determinista
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
    const { images, examType } = validatedData;
    // Note: images is now string[]

    const validImages: string[] = [];

    // Validate and sanitize images
    for (const image of images) {
      const imageValidation = validateImageUpload(image, 5000); // Max 5MB per image
      if (!imageValidation.valid) {
        // Log warning but skip invalid image if we have others? Or fail entire request?
        // Failing is safer for now.
        throw createError(
          imageValidation.error || getErrorMessage('INVALID_IMAGE', examType || 'examen_medico'),
          400,
          'INVALID_IMAGE'
        );
      }
      validImages.push(imageValidation.sanitized || image);
    }

    if (validImages.length === 0) {
      throw createError('No valid images to process', 400, 'NO_VALID_IMAGES');
    }

    // Check total estimated size
    const totalEstimatedBytes = validImages.reduce((acc, img) => {
      const base64Data = img.includes(';base64,') ? img.split(';base64,')[1] : img;
      return acc + (base64Data.length * 3) / 4;
    }, 0);

    if (totalEstimatedBytes > 20 * 1024 * 1024) { // Max 20MB payload limit (adjust as needed)
      throw createError(getErrorMessage('IMAGE_TOO_LARGE', examType || 'examen_medico'), 400, 'IMAGE_TOO_LARGE');
    }

    // Llamar a Gemini para extracción estructurada
    let structuredData: any;
    try {
      structuredData = await extractStructuredDataWithGemini(validImages, examType);
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

    // VALIDACIÓN CRÍTICA: Si Gemini determina que NO es un examen médico
    if (examTypeDetected.toUpperCase() === 'NO_MEDICO') {
      const reason = structuredData.hallazgos_visuales || 'No se detectó un documento médico válido.';
      logger.warn('Rechazo de imagen no médica:', reason);
      throw createError(
        `La imagen no parece ser un examen médico. ${reason}`,
        400,
        'INVALID_IMAGE_CONTENT'
      );
    }

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
      body: req.body ? { examType: req.body.examType, imagesCount: req.body.images?.length } : undefined,
    });

    // Ensure CORS headers are set before sending error response
    const origin = req.headers.origin || '';
    setCORSHeaders(res, origin);

    sendErrorResponse(res, error, req);
  }
}
