/**
 * Vercel Serverless Function
 * API Route para Gemini Vision - Procesamiento de imágenes con IA
 * POST /api/gemini/process-vision
 * 
 * Security: Rate limiting, input validation, image validation, error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GeminiVisionRequestSchema } from '../lib/validation.js';
import { geminiRateLimiter, rateLimitMiddleware } from '../lib/rateLimiter.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';
import { applySecurityHeaders, validateImageUpload } from '../lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  const origin = req.headers.origin || '';
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  applySecurityHeaders(res);
  
  // Re-assert CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const rateLimit = rateLimitMiddleware(geminiRateLimiter, req, res);
  if (!rateLimit.allowed) {
    Object.entries(rateLimit.headers || {}).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(429).json({
      error: 'Demasiadas solicitudes. Por favor, intenta de nuevo en un momento.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }
  Object.entries(rateLimit.headers || {}).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    // Validate input
    const validatedData = GeminiVisionRequestSchema.parse(req.body);
    const { image } = validatedData;

    // Validate and sanitize image
    const imageValidation = validateImageUpload(image, 5000); // Max 5MB
    if (!imageValidation.valid) {
      throw createError(
        imageValidation.error || 'Formato de imagen inválido',
        400,
        'INVALID_IMAGE'
      );
    }

    const sanitizedImage = imageValidation.sanitized || image;

    // Extract base64 data and mime type
    const base64Match = sanitizedImage.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!base64Match) {
      throw createError('Formato de imagen inválido', 400, 'INVALID_IMAGE_FORMAT');
    }

    const mimeType = base64Match[1] === 'jpg' ? 'image/jpeg' : `image/${base64Match[1]}`;
    const base64Data = base64Match[2];

    // Get API key from environment
    const apiKey = process.env.GEMINI_API;
    if (!apiKey) {
      throw createError('Gemini API key not configured', 500, 'CONFIG_ERROR');
    }

    // Size check (max 10MB)
    const imageBuffer = Buffer.from(base64Data, 'base64');
    if (imageBuffer.length > 10 * 1024 * 1024) {
      throw createError('La imagen es demasiado grande. El tamaño máximo es 10MB.', 400, 'IMAGE_TOO_LARGE');
    }

    // Prompt para Gemini Vision - detecta tipo de examen y extrae datos
    const visionPrompt = `Eres un asistente especializado en analizar exámenes médicos. 

Analiza esta imagen de un examen médico y:

1. DETECTA el tipo de examen (hormonal, metabólico, vitamina D, ecografía, HSG, espermiograma, o "unknown" si no lo reconoces)

2. EXTRAE todos los datos médicos estructurados (valores, unidades, rangos normales) en formato JSON

3. ELIMINA completamente cualquier dato personal (nombres, DNI, dirección, teléfono, email)

4. INCLUYE solo la fecha del examen si está visible

Responde SOLO con un JSON válido en este formato exacto:
{
  "detectedType": "hormonal" | "metabolic" | "vitamin_d" | "ecografia" | "hsg" | "espermio" | "unknown",
  "examDate": "YYYY-MM-DD" o null,
  "extractedData": {
    "campo1": { "value": 123, "unit": "mUI/mL", "normal": "10-50" },
    "campo2": { "value": 45.2, "unit": "ng/mL", "normal": "30-100" }
  },
  "sanitizedText": "texto completo sin datos personales"
}

Si no encuentras datos médicos, devuelve extractedData como objeto vacío {} pero siempre incluye detectedType.`;

    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-vision:generateContent?key=${apiKey}`;

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: visionPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1, // Bajo para resultados más consistentes
            maxOutputTokens: 4000,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Gemini Vision API Error:', {
          status: response.status,
          error: errorData,
        });
        throw createError(
          `Error en la API de Gemini Vision: ${errorData.error?.message || 'Error desconocido'}`,
          response.status,
          'GEMINI_VISION_API_ERROR'
        );
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!responseText) {
        throw createError('No se recibió respuesta de Gemini Vision', 500, 'EMPTY_RESPONSE');
      }

      // Parsear JSON de la respuesta
      let parsedResult: any;
      try {
        // Limpiar respuesta si tiene markdown code blocks
        const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedResult = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Error parsing Gemini Vision response:', {
          responseText: responseText.substring(0, 500),
          error: parseError,
        });
        throw createError(
          'Error al procesar la respuesta de Gemini Vision. Por favor, intenta de nuevo.',
          500,
          'PARSE_ERROR'
        );
      }

      return res.status(200).json({
        detectedType: parsedResult.detectedType || 'unknown',
        examDate: parsedResult.examDate || null,
        extractedData: parsedResult.extractedData || {},
        sanitizedText: parsedResult.sanitizedText || '',
        confidence: 0.95, // Gemini Vision es muy preciso
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw createError('Timeout al conectar con Gemini Vision API', 504, 'TIMEOUT_ERROR');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Gemini Vision API Error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body ? { hasImage: !!req.body.image } : undefined,
    });
    sendErrorResponse(res, error, req);
  }
}

