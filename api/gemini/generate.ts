/**
 * Vercel Serverless Function
 * API Route para Gemini
 * POST /api/gemini/generate
 * 
 * Security: Rate limiting, input validation, error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GeminiRequestSchema } from '../lib/validation';
import { geminiRateLimiter, rateLimitMiddleware } from '../lib/rateLimiter';
import { sendErrorResponse, createError } from '../lib/errorHandler';
import { applySecurityHeaders } from '../lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS - Allow localhost in development and production domains
  const origin = req.headers.origin || '';
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0');
  const allowedOrigins = [
    'https://method.fertyfit.com', // Solo la app en producción
    'http://localhost:5173',        // Desarrollo local
    'http://localhost:5174',        // Desarrollo local (puerto alternativo)
    'http://127.0.0.1:5173',        // Desarrollo local (IP)
  ];
  
  // Determine which origin to allow - prioritize exact match
  let allowedOrigin: string;
  if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin; // Use the exact origin from the request
  } else if (isLocalhost) {
    allowedOrigin = origin; // Even if not in list, allow localhost
  } else {
    allowedOrigin = 'https://method.fertyfit.com'; // Fallback to production origin
  }
  
  // Always set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apply security headers
  applySecurityHeaders(res);
  
  // Re-assert CORS headers after security headers to ensure they're not overwritten
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  // Only allow POST
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
    const validatedData = GeminiRequestSchema.parse(req.body);
    const { prompt, maxTokens = 200, temperature = 0.9 } = validatedData;

    // Get API key from environment
    const apiKey = process.env.GEMINI_API;
    if (!apiKey) {
      throw createError('Gemini API key not configured', 500, 'CONFIG_ERROR');
    }

    // Sanitize prompt (remove potential injection)
    const sanitizedPrompt = prompt
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .slice(0, 10000); // Hard limit

    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Add timeout to request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: sanitizedPrompt }] }],
          generationConfig: {
            temperature: Math.max(0, Math.min(2, temperature)), // Clamp between 0-2
            maxOutputTokens: Math.max(1, Math.min(2000, maxTokens)), // Clamp between 1-2000
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw createError(
          'Error en la API de Gemini',
          response.status,
          'GEMINI_API_ERROR'
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return res.status(200).json({ text });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw createError('Timeout al conectar con Gemini API', 504, 'TIMEOUT_ERROR');
      }
      throw fetchError;
    }
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}

