import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../../server/lib/security.js';
import { sendErrorResponse, createError } from '../../server/lib/errorHandler.js';
import { logger } from '../../server/lib/logger.js';
import { generateStructuredReportHtml } from '../../services/reportHtmlGenerator.js';
import type { AppNotification } from '../../types.js';
import puppeteer from 'puppeteer';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Supabase URL o SERVICE ROLE KEY no están configuradas en las variables de entorno'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

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
      throw createError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }

    const { reportId } = req.body as { reportId?: number };
    if (!reportId) {
      throw createError('Falta reportId en la solicitud', 400, 'BAD_REQUEST');
    }

    const { data: report, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !report) {
      logger.error('No se encontró el informe para PDF:', error);
      throw createError('Informe no encontrado', 404, 'NOT_FOUND');
    }

    const appReport = report as AppNotification;
    const html = generateStructuredReportHtml({ report: appReport });

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '2cm',
          right: '2cm',
          bottom: '2cm',
          left: '2cm',
        },
      });

      const fileName = `${appReport.title.replace(/[^a-zA-Z0-9-_]/g, '_') || 'informe-fertyfit'}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      return res.status(200).end(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (error: any) {
    setCORSHeaders(res, origin);
    logger.error('Error generando PDF de informe:', error?.message || error);
    return sendErrorResponse(res, error, req);
  }
}

