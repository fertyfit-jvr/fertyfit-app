/**
 * Vercel Serverless Function
 * API Route para OCR con Google Cloud Vision
 * POST /api/ocr/process
 * 
 * Security: Rate limiting, input validation, image validation, error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OCRRequestSchema } from '../lib/validation.js';
import { ocrRateLimiter, rateLimitMiddleware } from '../lib/rateLimiter.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';
import { applySecurityHeaders, validateImageUpload } from '../lib/security.js';
import { validateExtractedData, getErrorMessage } from '../lib/medicalValidation.js';
import { ai } from '../lib/ai.js';

// Logger simple para serverless functions (solo para serverless, no usar en frontend)
const logger = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

// Extracción estructurada con Gemini 2.5 Flash
async function extractStructuredDataWithGemini(
  base64Image: string,
  examType: 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio'
) {
  const prompt = `
Eres un extractor de datos médicos muy preciso para un examen de tipo "${examType}".
Extrae todos los resultados, rangos de referencia y unidades.

DEVUELVE UN ÚNICO OBJETO JSON con la forma:
{
  "resultados": [
    {
      "parametro": string,
      "valor": number | string,
      "unidades": string | null,
      "rango_referencia": string | null
    }
  ]
}

No añadas nada fuera del JSON (ni explicaciones, ni texto adicional).`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { text: prompt },
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg',
        },
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  } as any);

  const jsonText = (response as any).text ?? JSON.stringify(response);
  return JSON.parse(jsonText);
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
        imageValidation.error || getErrorMessage('INVALID_IMAGE', examType),
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
      throw createError(getErrorMessage('IMAGE_TOO_LARGE', examType), 400, 'IMAGE_TOO_LARGE');
    }

    // Llamar a Gemini para extracción estructurada
    let structuredData: any;
    try {
      structuredData = await extractStructuredDataWithGemini(base64Data, examType);
    } catch (ocrError: any) {
      logger.error('Gemini OCR Error:', {
        message: ocrError instanceof Error ? ocrError.message : String(ocrError),
        stack: ocrError instanceof Error ? ocrError.stack : undefined,
        examType,
      });
      // Reusar mensaje de timeout o genérico según convenga
      throw createError(
        getErrorMessage('TIMEOUT_ERROR', examType),
        504,
        'TIMEOUT_ERROR'
      );
    }

    // Mapeamos el JSON de Gemini a un objeto de campos numéricos compatible con validateExtractedData
    const rawParsedData: Record<string, any> = {};
    const resultados = Array.isArray(structuredData?.resultados)
      ? structuredData.resultados
      : [];

    // Si no hay resultados estructurados, probablemente no es un examen médico válido
    if (!resultados || resultados.length === 0) {
      throw createError(getErrorMessage('NO_MEDICAL_EXAM', examType), 400, 'NO_MEDICAL_EXAM');
    }

    for (const item of resultados) {
      const parametro = String(item.parametro || '').toLowerCase().trim();
      const valor = item.valor;

      // Mapear nombres de parámetro a keys internas usadas en MEDICAL_RANGES
      // (simplificado; se puede refinar con más reglas)
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
      if (parametro.includes('volumen') && examType === 'espermio') {
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

    // Validar los datos extraídos
    let dataValidation;
    try {
      dataValidation = validateExtractedData(rawParsedData, examType);
    } catch (validationError: any) {
      logger.error('Error validating data:', validationError);
      dataValidation = {
        isValid: true,
        warnings: ['Algunos valores no pudieron ser validados. Por favor, revísalos manualmente.'],
        errors: [],
        validatedData: rawParsedData,
      };
    }

    return res.status(200).json({
      parsedData: dataValidation.validatedData,
      warnings: dataValidation.warnings,
      errors: dataValidation.errors,
      raw: structuredData,
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

