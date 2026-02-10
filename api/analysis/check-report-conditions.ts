/**
 * Check Report Conditions Endpoint
 * 
 * Verifica las condiciones para generar un informe y retorna advertencias.
 * NO bloquea la generación - solo informa al usuario.
 * Usado por botones manuales en ReportsAndAnalysisModal.
 * 
 * POST /api/analysis/check-report-conditions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applySecurityHeaders } from '../../server/lib/security.js';
import { sendErrorResponse, createError } from '../../server/lib/errorHandler.js';
import { logger } from '../../server/lib/logger.js';
import { getReportWarnings } from './reportRules.js';

// CORS helper
function setCORSHeaders(res: VercelResponse, origin: string): string {
  const isLocalhost =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('0.0.0.0');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  return allowedOrigin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || '';
  setCORSHeaders(res, origin);

  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.setHeader('Content-Length', '0');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.end();
  }

  try {
    applySecurityHeaders(res);
    setCORSHeaders(res, origin);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, reportType } = req.body as {
      userId?: string;
      reportType?: 'BASIC' | 'DAILY' | 'LABS' | '360';
    };

    if (!userId || !reportType) {
      throw createError('Faltan parámetros: userId y reportType son requeridos', 400, 'BAD_REQUEST');
    }

    if (!['BASIC', 'DAILY', 'LABS', '360'].includes(reportType)) {
      throw createError('Tipo de informe inválido', 400, 'INVALID_REPORT_TYPE');
    }

    logger.log(`[CHECK_CONDITIONS] Checking ${reportType} for user ${userId}`);

    // Obtener advertencias (no bloquea)
    const warnings = await getReportWarnings(userId, reportType);

    logger.log(`[CHECK_CONDITIONS] Warnings for ${reportType}: ${warnings.length}`);

    return res.status(200).json({
      success: true,
      warnings,
      reportType,
      canContinue: true, // Siempre true - solo informativo
    });
  } catch (error: any) {
    setCORSHeaders(res, origin);
    logger.error('[CHECK_CONDITIONS] Error:', error);
    sendErrorResponse(res, error, req);
  }
}
