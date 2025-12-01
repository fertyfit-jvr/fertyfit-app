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
import { validateMedicalExamText, validateExtractedData, getErrorMessage } from '../lib/medicalValidation.js';

// Logger simple para serverless functions
const logger = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
};

// Importar Google Cloud Vision (se instalará como dependencia)
let vision: any = null;

async function getVisionClient() {
  if (vision) return vision;

  try {
    // Importar dinámicamente para evitar errores en build
    const { ImageAnnotatorClient } = await import('@google-cloud/vision');
    
    const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!credentials || !projectId) {
      throw createError('Google Cloud credentials not configured', 500, 'CONFIG_ERROR');
    }

    // Parsear credenciales JSON con validación
    let credentialsObj;
    try {
      credentialsObj = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
    } catch (parseError) {
      throw createError('Invalid credentials format', 500, 'CONFIG_ERROR');
    }

    vision = new ImageAnnotatorClient({
      projectId,
      credentials: credentialsObj,
    });

    return vision;
  } catch (error) {
    throw createError('Error initializing Vision client', 500, 'VISION_INIT_ERROR');
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
  res.setHeader('Content-Type', 'application/json');
  
  return allowedOrigin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Wrap everything in try-catch to ensure JSON responses always
  try {
    // Handle CORS - Allow localhost in development and production domains
    const origin = req.headers.origin || '';
    const allowedOrigin = setCORSHeaders(res, origin);
    
    logger.log('CORS Debug:', { origin, allowedOrigin, method: req.method });

    // Handle preflight - must return early
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Apply security headers AFTER CORS (security headers don't include CORS)
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

    try {
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

    // Get Vision client
    const client = await getVisionClient();

    // Convert base64 to buffer with size check
    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch (bufferError) {
      throw createError('Error processing image data', 400, 'IMAGE_PROCESSING_ERROR');
    }

    // Size check (max 10MB)
    if (imageBuffer.length > 10 * 1024 * 1024) {
      throw createError(getErrorMessage('IMAGE_TOO_LARGE', examType), 400, 'IMAGE_TOO_LARGE');
    }

    // Perform OCR with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for OCR

    try {
      const [result] = await client.textDetection({
        image: { content: imageBuffer },
      });

      clearTimeout(timeoutId);

      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        throw createError(getErrorMessage('NO_TEXT_DETECTED', examType), 400, 'NO_TEXT_DETECTED');
      }

      // El primer elemento contiene todo el texto
      const fullText = detections[0].description || '';

      if (!fullText || fullText.trim().length < 10) {
        throw createError(getErrorMessage('INSUFFICIENT_TEXT', examType), 400, 'INSUFFICIENT_TEXT');
      }

      // Validar que el texto parece ser un examen médico
      const textValidation = validateMedicalExamText(fullText, examType);
      
      // Parsear el texto según el tipo de examen (siempre, aunque no sea válido)
      // Esto permite mostrar lo que se encontró aunque no sea un examen médico válido
      let rawParsedData: Record<string, any> = {};
      try {
        // Importar parseExam - en Vercel necesitamos usar la ruta relativa desde api/
        const examParsersModule = await import('../services/examParsers.js');
        const parseExam = examParsersModule.parseExam;
        
        if (!parseExam || typeof parseExam !== 'function') {
          throw new Error('parseExam function not found');
        }
        
        rawParsedData = parseExam(fullText, examType);
      } catch (parseError: any) {
        logger.error('Error parsing exam:', {
          error: parseError.message,
          stack: parseError.stack,
          examType,
          textLength: fullText.length,
        });
        throw createError(
          'Error al procesar los datos del examen. Por favor, intenta con otra foto.',
          500,
          'PARSE_ERROR'
        );
      }

      // Validar los datos extraídos
      let dataValidation;
      try {
        dataValidation = validateExtractedData(rawParsedData, examType);
      } catch (validationError: any) {
        logger.error('Error validating data:', validationError);
        // Si falla la validación, devolver los datos sin validar pero con advertencia
        dataValidation = {
          isValid: true,
          warnings: ['Algunos valores no pudieron ser validados. Por favor, revísalos manualmente.'],
          errors: [],
          validatedData: rawParsedData,
        };
      }

      // Combinar advertencias de validación de texto y datos
      const allWarnings = [
        ...(textValidation.warnings || []),
        ...(dataValidation.warnings || [])
      ];
      
      // Si no es un examen médico válido, agregar advertencia pero no rechazar
      if (!textValidation.isMedicalExam) {
        allWarnings.push(
          `No se detectaron suficientes términos médicos para un ${examType === 'hormonal' ? 'panel hormonal' : 
            examType === 'metabolic' ? 'panel metabólico' : 
            examType === 'vitamin_d' ? 'análisis de Vitamina D' :
            examType === 'ecografia' ? 'ecografía' :
            examType === 'hsg' ? 'histerosalpingografía' : 'espermiograma'}. ` +
          `Se procesará la imagen de todas formas, pero por favor verifica que los datos sean correctos.`
        );
      }

      return res.status(200).json({
        text: fullText,
        parsedData: dataValidation.validatedData,
        warnings: allWarnings,
        errors: dataValidation.errors,
        confidence: textValidation.confidence,
        isMedicalExam: textValidation.isMedicalExam,
      });
    } catch (ocrError: any) {
      clearTimeout(timeoutId);
      if (ocrError.name === 'AbortError') {
        throw createError(getErrorMessage('TIMEOUT_ERROR', examType), 504, 'TIMEOUT_ERROR');
      }
      throw ocrError;
    }
    } catch (error) {
      // Log error details for debugging
      logger.error('OCR API Error:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body ? { examType: req.body.examType, hasImage: !!req.body.image } : undefined,
      });
      sendErrorResponse(res, error, req);
    }
  } catch (globalError) {
    // Catch any error that occurs before the main try block
    // This ensures we always return a valid JSON response with CORS
    const origin = req.headers.origin || '';
    setCORSHeaders(res, origin);
    
    logger.error('OCR Global Error:', {
      message: globalError instanceof Error ? globalError.message : String(globalError),
      stack: globalError instanceof Error ? globalError.stack : undefined,
    });
    
    sendErrorResponse(res, globalError, req);
  }
}

