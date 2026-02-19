/**
 * Vercel Cron Job: Generate DAILY Reports
 * 
 * Se ejecuta diariamente a las 8:00 AM UTC
 * Para cada usuario con method_start_date:
 * - Verifica si hoy corresponde generar informe DAILY (cada 15 días)
 * - Verifica que haya al menos 7 registros en últimos 15 días
 * - Si cumple condiciones, genera el informe
 * 
 * GET /api/cron/generate-daily-reports
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../../server/lib/logger.js';
import { getUsersWithMethodStartDate, shouldGenerateDaily } from '../../server/lib/reportRules.js';

export const config = {
  maxDuration: 300, // 5 minutos máximo
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verificar que es un request GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // 2. Verificar autenticación de Vercel Cron
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('[CRON_DAILY] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  logger.log('[CRON_DAILY] Starting DAILY reports generation job');
  const startTime = Date.now();

  try {
    // 3. Obtener todos los usuarios con method_start_date
    const users = await getUsersWithMethodStartDate();
    logger.log(`[CRON_DAILY] Found ${users.length} users with method_start_date`);

    const results = {
      total: users.length,
      generated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    // 4. Para cada usuario, verificar si debe generar DAILY
    for (const user of users) {
      try {
        const check = await shouldGenerateDaily(user.id);

        if (!check.shouldGenerate) {
          results.skipped++;
          logger.log(`[CRON_DAILY] Skipped user ${user.id}: ${check.reason}`);
          continue;
        }

        // 5. Generar informe DAILY
        logger.log(`[CRON_DAILY] Generating DAILY report for user ${user.id}`);

        const response = await fetch(`${process.env.VITE_SUPABASE_URL?.replace('/rest/v1', '')}/api/analysis/report-extended`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            reportType: 'DAILY',
            manualTrigger: false, // Es automático
          }),
        });

        if (response.ok) {
          results.generated++;
          logger.log(`[CRON_DAILY] ✅ Generated DAILY report for user ${user.id}`);
        } else {
          const errorText = await response.text();
          results.failed++;
          results.errors.push({
            userId: user.id,
            error: `HTTP ${response.status}: ${errorText}`,
          });
          logger.error(`[CRON_DAILY] ❌ Failed for user ${user.id}:`, errorText);
        }
      } catch (userError: any) {
        // Error para un usuario específico - no detener el job
        results.failed++;
        results.errors.push({
          userId: user.id,
          error: userError.message || 'Unknown error',
        });
        logger.error(`[CRON_DAILY] ❌ Error processing user ${user.id}:`, userError);
      }
    }

    const duration = Date.now() - startTime;
    logger.log(`[CRON_DAILY] Job completed in ${duration}ms`, results);

    // 6. Retornar resumen
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('[CRON_DAILY] Job failed:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      duration_ms: duration,
    });
  }
}
