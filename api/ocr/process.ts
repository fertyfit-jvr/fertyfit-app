/**
 * Vercel Serverless Function
 * API Route para OCR con Google Cloud Vision
 * POST /api/ocr/process
 * 
 * Security: Rate limiting, input validation, image validation, error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OCRRequestSchema } from '../../lib/validation';
import { ocrRateLimiter, rateLimitMiddleware } from '../../lib/rateLimiter';
import { sendErrorResponse, createError } from '../../lib/errorHandler';
import { applySecurityHeaders, validateImageUpload } from '../../lib/security';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply security headers
  applySecurityHeaders(res);

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
      throw createError(imageValidation.error || 'Invalid image', 400, 'INVALID_IMAGE');
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
      throw createError('Image too large. Maximum size: 10MB', 400, 'IMAGE_TOO_LARGE');
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
        throw createError('No se detectó texto en la imagen', 400, 'NO_TEXT_DETECTED');
      }

      // El primer elemento contiene todo el texto
      const fullText = detections[0].description || '';

      if (!fullText || fullText.trim().length < 10) {
        throw createError('Texto detectado insuficiente', 400, 'INSUFFICIENT_TEXT');
      }

      // Parsear el texto según el tipo de examen
      const { parseExam } = await import('../../services/examParsers.js');
      const parsedData = parseExam(fullText, examType);

      return res.status(200).json({
        text: fullText,
        parsedData,
      });
    } catch (ocrError: any) {
      clearTimeout(timeoutId);
      if (ocrError.name === 'AbortError') {
        throw createError('Timeout al procesar la imagen', 504, 'TIMEOUT_ERROR');
      }
      throw ocrError;
    }
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}

