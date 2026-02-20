import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ai } from '../../server/lib/ai.js';
import { applySecurityHeaders } from '../../server/lib/security.js';
import { sendErrorResponse, createError } from '../../server/lib/errorHandler.js';
import { searchRagDirect } from '../../server/lib/ragUtils.js';
import { logger } from '../../server/lib/logger.js';
import type { UserProfile, DailyLog, ConsultationForm, AppNotification } from '../../types.js';
import {
  buildReportContext,
  getPromptForReportType,
  getRAGQueryForReportType,
  getReportTitle,
  type ReportType,
} from '../../server/lib/report-helpers.js';
import { canGenerateBasic } from '../../server/lib/reportRules.js';
import { serializeFormsForBasicReport } from '../../services/reportFormSerializer.js';

// Supabase client para entorno serverless (usar process.env, no import.meta.env)
// Usamos SERVICE ROLE KEY para bypassear RLS y poder leer todos los datos del usuario
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

// Helper CORS similar al de /api/ocr/process
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  return allowedOrigin;
}

/**
 * Envía un evento de progreso al cliente (formato NDJSON)
 */
function sendProgress(
  res: VercelResponse,
  stage: string,
  message: string,
  data?: any
): void {
  const event = { stage, message, data, timestamp: new Date().toISOString() };
  res.write(`${JSON.stringify(event)}\n`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS primero
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
    // Seguridad después de CORS
    applySecurityHeaders(res);
    // Reafirmar CORS tras los headers de seguridad
    setCORSHeaders(res, origin);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, reportType = '360', labsScope = 'LAST', manualTrigger = false } = req.body as {
      userId?: string;
      reportType?: ReportType;
      labsScope?: 'LAST' | 'ALL';
      manualTrigger?: boolean;
    };

    if (!userId) {
      throw createError('Falta el userId en la solicitud', 400, 'BAD_REQUEST');
    }

    // Validar reportType
    if (!['360', 'BASIC', 'DAILY', 'LABS'].includes(reportType)) {
      throw createError('Tipo de informe inválido', 400, 'INVALID_REPORT_TYPE');
    }

    // 0. VALIDACIÓN DE REGLAS (solo para generación automática)
    // Si manualTrigger = true, se bypasean todas las reglas
    if (!manualTrigger) {
      // VALIDACIÓN PARA BASIC
      if (reportType === 'BASIC') {
        const { canGenerate, reason } = await canGenerateBasic(userId);
        if (!canGenerate) {
          logger.info(`[REPORT_BLOCKED] ${reason}`);
          res.status(200).json({
            message: reason,
            skipped: true,
            reason: 'VALIDATION_FAILED'
          });
          return res.end();
        }
      }

      // Las validaciones de DAILY, LABS y 360 se hacen en los cron jobs
      // o en los puntos de trigger, no aquí
    } else {
      // Es una generación manual - registrar en logs
      logger.info(`[MANUAL_REPORT] User ${userId} manually triggered ${reportType} report`);
    }

    // Configurar streaming response (NDJSON)
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    sendProgress(res, 'INITIALIZING', 'Iniciando generación del informe...');

    // 1. Perfil (tabla profiles)
    sendProgress(res, 'COLLECTING_PROFILE', 'Recopilando tu perfil y datos básicos...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      sendProgress(res, 'ERROR', 'No se encontró el perfil de la usuaria', {
        error: profileError?.message,
      });
      return res.end();
    }

    const userProfile: UserProfile = {
      id: userId,
      email: profile.email || undefined,
      name: profile.name || 'Paciente',
      joinedAt: profile.created_at,
      methodStartDate: profile.method_start_date || undefined,
      age: profile.age || 0,
      weight: profile.weight || 0,
      height: profile.height || 0,
      treatments: [],
      isOnboarded: true,
      mainObjective: profile.main_objective || undefined,
      partnerStatus: profile.partner_status || undefined,
      cycleLength: profile.cycle_length || undefined,
      cycleRegularity: profile.cycle_regularity || undefined,
      lastPeriodDate: profile.last_period_date || undefined,
      periodHistory: profile.period_history || [],
      diagnoses: profile.diagnoses || [],
      fertilityTreatments: profile.fertility_treatments || undefined,
      // supplements: profile.supplements || undefined,
      // smoker: profile.smoker || undefined,
      // alcoholConsumption: profile.alcohol_consumption || undefined,
    };

    const userProfileSummary = {
      id: userProfile.id,
      nombre: userProfile.name,
      email: userProfile.email ?? null,
      birthDate: profile.birth_date ?? null,
      age: userProfile.age,
      weight: userProfile.weight,
      height: userProfile.height,
      mainObjective: userProfile.mainObjective ?? null,
      partnerStatus: userProfile.partnerStatus ?? null,
      methodStartDate: userProfile.methodStartDate ?? null,
    };

    // Información básica de ciclo para el informe (última y próxima regla)
    let cycleInfo: {
      last_period_date?: string;
      next_period_date?: string;
      days_until_next_period?: number | null;
    } | null = null;

    if (profile.last_period_date && profile.cycle_length && profile.cycle_length > 0) {
      try {
        const last = new Date(profile.last_period_date);
        const today = new Date();
        last.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const msPerDay = 1000 * 60 * 60 * 24;
        const diffDays = Math.floor((today.getTime() - last.getTime()) / msPerDay);
        const cyclesCompleted = Math.floor(diffDays / profile.cycle_length);

        const next = new Date(last);
        next.setDate(next.getDate() + (cyclesCompleted + 1) * profile.cycle_length);
        next.setHours(0, 0, 0, 0);

        const daysUntil = Math.ceil((next.getTime() - today.getTime()) / msPerDay);

        cycleInfo = {
          last_period_date: profile.last_period_date,
          next_period_date: next.toISOString().split('T')[0],
          days_until_next_period: daysUntil,
        };
      } catch (cycleError) {
        logger.warn('No se pudo calcular información de ciclo para informe:', cycleError);
      }
    }

    // Resumen FertyScore (no se recalcula, se lee de la tabla ferty_scores)
    let fertyScoreSummary:
      | {
        total: number | null;
        function: number | null;
        food: number | null;
        flora: number | null;
        flow: number | null;
        calculated_at: string;
      }
      | null = null;

    if (reportType === 'BASIC' || reportType === '360') {
      try {
        const { data: scoresData, error: scoresError } = await supabase
          .from('ferty_scores')
          .select('global_score,function_score,food_score,flora_score,flow_score,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (scoresError) {
          logger.warn('No se pudo cargar ferty_scores para informe:', scoresError);
        } else if (scoresData && scoresData.length > 0) {
          const s = scoresData[0] as any;
          fertyScoreSummary = {
            total: s.global_score ?? null,
            function: s.function_score ?? null,
            food: s.food_score ?? null,
            flora: s.flora_score ?? null,
            flow: s.flow_score ?? null,
            calculated_at: s.created_at,
          };
        }
      } catch (scoreError) {
        logger.warn('Excepción al cargar ferty_scores para informe:', scoreError);
      }
    }

    // 2. Registros diarios (usados en 360, DAILY)
    let logs: DailyLog[] = [];
    if (reportType === '360' || reportType === 'DAILY') {
      sendProgress(res, 'COLLECTING_LOGS', 'Recopilando tus registros diarios...');
      const { data: logsData, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (logsError) {
        logger.warn('Error al cargar registros diarios:', logsError);
      } else {
        logs =
          logsData?.map((dbLog: any) => ({
            id: dbLog.id,
            user_id: dbLog.user_id,
            date: dbLog.date,
            cycleDay: dbLog.cycle_day,
            bbt: dbLog.bbt,
            mucus: dbLog.mucus || '',
            cervixHeight: dbLog.cervix_height || '',
            cervixFirmness: dbLog.cervix_firmness || '',
            cervixOpenness: dbLog.cervix_openness || '',
            lhTest: dbLog.lh_test || 'No realizado',
            symptoms: dbLog.symptoms || [],
            sex: dbLog.sex,
            sleepQuality: dbLog.sleep_quality,
            sleepHours: dbLog.sleep_hours,
            stressLevel: dbLog.stress_level,
            activityMinutes: dbLog.activity_minutes || 0,
            sunMinutes: dbLog.sun_minutes || 0,
            waterGlasses: dbLog.water_glasses,
            veggieServings: dbLog.veggie_servings,
            alcohol: dbLog.alcohol,
            alcoholUnits: dbLog.alcohol_units || undefined,
          })) || [];
      }
    }

    // 3. Formularios / exámenes (solo si es necesario)
    let forms: ConsultationForm[] = [];
    if (reportType === '360' || reportType === 'BASIC' || reportType === 'LABS') {
      sendProgress(res, 'COLLECTING_FORMS', 'Recopilando tus formularios y exámenes...');
      const { data: formsData, error: formsError } = await supabase
        .from('consultation_forms')
        .select('*')
        .eq('user_id', userId);

      if (formsError) {
        logger.warn('Error al cargar formularios:', formsError);
      } else {
        forms = (formsData as ConsultationForm[]) || [];
      }
    }

    // 4. Informes previos (solo para informe 360)
    let previousReports: AppNotification[] = [];
    if (reportType === '360') {
      sendProgress(res, 'COLLECTING_PREVIOUS_REPORTS', 'Revisando informes anteriores...');
      const { data: reportsData, error: reportsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'REPORT')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!reportsError && reportsData && reportsData.length > 0) {
        const allReports = reportsData as AppNotification[];

        const basicReports = allReports.filter(r => r.metadata?.report_type === 'BASIC').slice(0, 1);
        const labsReports = allReports.filter(r => r.metadata?.report_type === 'LABS').slice(0, 2);
        const dailyReports = allReports.filter(r => r.metadata?.report_type === 'DAILY').slice(0, 2);

        previousReports = [...basicReports, ...labsReports, ...dailyReports];

        // Si tenemos informes DAILY previos recientes, no necesitamos todos los logs crudos
        if (dailyReports.length > 0) {
          logger.info(`[REPORT 360] Found ${dailyReports.length} DAILY reports, skipping raw daily_logs to save tokens.`);
          logs = [];
        }
      }
    }

    // 5. Buscar en base de conocimiento RAG
    sendProgress(res, 'SEARCHING_KNOWLEDGE', 'Buscando información relevante en nuestra base de conocimiento...');
    let ragContext = '';
    let ragChunks: Array<{ content: string; metadata?: Record<string, any> }> = [];
    let ragUsed = false;
    let ragChunksCount = 0;

    try {
      const ragQuery = getRAGQueryForReportType(
        reportType === 'LABS' ? 'BASIC' : reportType,
        userProfile.age
      );
      console.log('[REPORT] Step 5: RAG query:', ragQuery.substring(0, 100));
      ragChunks = await searchRagDirect(ragQuery, undefined, 15);

      if (ragChunks.length > 0) {
        ragChunksCount = ragChunks.length;
        ragContext = ragChunks.map((c) => c.content).join('\n\n');
        ragUsed = ragContext.length > 0;
        console.log(`[REPORT] ✅ RAG OK: ${ragChunksCount} chunks, context length: ${ragContext.length}`);
      } else {
        console.warn('[REPORT] ⚠️ RAG returned 0 chunks - report will have NO academic sources');
      }
    } catch (ragError: any) {
      console.error('[REPORT] ❌ RAG FAILED:', ragError?.message || ragError);
      // Continuamos sin RAG - el informe se generará pero sin fuentes
    }

    // 6. Construir contexto según tipo de informe
    sendProgress(res, 'ANALYZING_DATA', 'Analizando todos tus datos...');

    // Para LABS, construir subconjunto de formularios: F0 + pilares + analíticas (última o todas)
    let formsForContext: ConsultationForm[] = forms;
    if (reportType === 'LABS') {
      const f0Forms = forms.filter((f) => f.form_type === 'F0');
      const pillarForms = forms.filter((f) =>
        ['FUNCTION', 'FOOD', 'FLORA', 'FLOW'].includes(f.form_type || '')
      );
      const examForms = forms.filter((f) =>
        f.form_type === 'EXAM' || f.answers?.some((a: any) => a.questionId === 'exam_type')
      );

      const sortedExamForms = [...examForms].sort((a, b) => {
        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return dateB - dateA;
      });

      const selectedExamForms =
        labsScope === 'ALL' ? sortedExamForms : sortedExamForms.slice(0, 1);

      formsForContext = [...f0Forms, ...pillarForms, ...selectedExamForms];
    }

    const context = buildReportContext(
      reportType,
      userProfile,
      logs,
      formsForContext,
      previousReports.length > 0 ? previousReports : undefined
    );

    // Serializar formularios para el informe BASIC (portada de preconsulta)
    let serializedForms: any = null;
    if (reportType === 'BASIC') {
      try {
        serializedForms = serializeFormsForBasicReport(forms);
      } catch (serializeError) {
        logger.warn('No se pudo serializar formularios para informe BASIC:', serializeError);
      }
    }

    // Calcular promedios de daily logs para el 360 (últimos 30 días)
    let dailyLogsSummary30d: any = null;
    if (reportType === '360') {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const logsLast30d = logs.filter((log) => {
          const logDate = new Date(log.date);
          return logDate >= cutoffDate;
        });

        if (logsLast30d.length > 0) {
          const totalSleep = logsLast30d.reduce(
            (acc, log) => acc + (log.sleepHours ?? 0),
            0
          );
          const totalStress = logsLast30d.reduce(
            (acc, log) => acc + (log.stressLevel ?? 0),
            0
          );
          const totalWater = logsLast30d.reduce(
            (acc, log) => acc + (log.waterGlasses ?? 0),
            0
          );
          const totalVegetables = logsLast30d.reduce(
            (acc, log) => acc + (log.veggieServings ?? 0),
            0
          );
          const daysWithAlcohol = logsLast30d.filter((log) => log.alcohol).length;

          dailyLogsSummary30d = {
            period_days: logsLast30d.length,
            avg_sleep: (totalSleep / logsLast30d.length).toFixed(1),
            avg_stress: (totalStress / logsLast30d.length).toFixed(1),
            avg_water: (totalWater / logsLast30d.length).toFixed(1),
            avg_vegetables: (totalVegetables / logsLast30d.length).toFixed(1),
            days_with_alcohol: daysWithAlcohol,
          };
        }
      } catch (summaryError) {
        logger.warn('No se pudo calcular resumen de daily_logs para 360:', summaryError);
      }
    }

    // 7. Generar prompt especializado
    const ragChunksMetadata = ragChunks.map((c) => ({
      document_id: c.metadata?.document_id || '',
      document_title: c.metadata?.document_title || '',
      chunk_index: c.metadata?.chunk_index || 0,
    }));

    const prompt = getPromptForReportType(
      reportType === 'LABS' ? 'BASIC' : reportType,
      ragContext,
      ragChunksCount,
      previousReports.length > 0,
      ragChunksMetadata
    );

    // 8. Generar informe con Gemini (con reintentos para 429)
    sendProgress(res, 'GENERATING', 'Generando tu informe personalizado con IA...');
    console.log('[REPORT] Step 8: Calling Gemini API for', reportType, 'userId:', userId);

    let reportText: string;
    const MAX_RETRIES = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[REPORT] Gemini attempt ${attempt}/${MAX_RETRIES}`);
        const response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: prompt + '\n\n---DATOS DE LA USUARIA---\n\n' + JSON.stringify(context),
        });

        // @google/genai v1.x: response.text is a string getter
        let responseText: string | undefined;
        if (response && typeof response === 'object') {
          if (typeof (response as any).text === 'string') {
            responseText = (response as any).text;
          }
          if (!responseText) {
            const candidates = (response as any).candidates;
            if (candidates && candidates[0]?.content?.parts?.[0]?.text) {
              responseText = candidates[0].content.parts[0].text;
            }
          }
        }

        if (typeof responseText === 'string' && responseText.length > 0) {
          reportText = responseText;
          console.log('[REPORT] Report text generated, length:', reportText.length);
          lastError = null;
          break; // Éxito, salir del loop
        } else {
          console.error('[REPORT] Gemini returned no text. Response keys:', response ? Object.keys(response) : 'null');
          reportText = 'No se pudo generar el informe. La IA no devolvió texto. Por favor, intenta de nuevo.';
          lastError = null;
          break; // No es un error retriable
        }
      } catch (aiError: any) {
        lastError = aiError;
        const errorMsg = typeof aiError?.message === 'string' ? aiError.message : JSON.stringify(aiError);
        const is429 = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('exhausted');

        console.error(`[REPORT] Gemini attempt ${attempt} FAILED (retriable=${is429}):`, errorMsg);

        if (is429 && attempt < MAX_RETRIES) {
          const waitMs = 3000 * Math.pow(2, attempt - 1); // 3s, 6s, 12s
          sendProgress(res, 'RETRYING', `Esperando ${waitMs / 1000}s por límite de velocidad de la IA (intento ${attempt}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        // No retriable o max retries reached
        break;
      }
    }

    // Si después de todos los intentos seguimos con error
    if (lastError) {
      const errorMsg = typeof lastError?.message === 'string' ? lastError.message : JSON.stringify(lastError);
      reportText = `Error al generar el informe con IA después de ${MAX_RETRIES} intentos: ${errorMsg}. Por favor, intenta de nuevo en unos minutos.`;
    }
    reportText = reportText!;

    // 9. Guardar el informe en notifications
    console.log('[REPORT] Step 9: Saving report to notifications table for userId:', userId);
    try {
      const baseTitle =
        reportType === 'LABS' ? 'Informe de Analíticas' : getReportTitle(reportType);
      const reportTitle = `${baseTitle} - ${new Date().toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;

      const { data: insertData, error: insertError } = await supabase.from('notifications').insert({
        user_id: userId,
        type: 'REPORT',
        title: reportTitle,
        message: reportText,
        priority: 1,
        is_read: false,
        metadata: {
          report_type: reportType,
          format: 'markdown',
          manual_trigger: manualTrigger,
          user_profile_summary:
            reportType === 'BASIC' || reportType === '360' ? userProfileSummary : undefined,
          cycle_info:
            reportType === 'BASIC' || reportType === '360' ? cycleInfo : undefined,
          fertyscore:
            reportType === 'BASIC' || reportType === '360' ? fertyScoreSummary : undefined,
          basic_forms: reportType === 'BASIC' ? serializedForms : undefined,
          daily_logs_summary_30d: reportType === '360' ? dailyLogsSummary30d : undefined,
          input: { userId, reportType, ...(reportType === 'LABS' ? { labsScope } : {}) },
          sources: ragChunks.map((c) => ({
            document_id: c.metadata?.document_id || '',
            document_title: c.metadata?.document_title || '',
            chunk_index: c.metadata?.chunk_index || 0,
          })),
          rag_used: ragUsed,
          rag_chunks_count: ragChunksCount,
          rag_context_length: ragContext.length,
          generated_at: new Date().toISOString(),
        },
      }).select();

      if (insertError) {
        console.error('[REPORT] ❌ FAILED to save notification:', insertError.message, insertError.code, insertError.details);
      } else {
        console.log('[REPORT] ✅ Notification saved successfully. ID:', insertData?.[0]?.id);
      }
    } catch (saveError: any) {
      console.error('[REPORT] ❌ EXCEPTION saving notification:', saveError?.message || saveError);
    }

    // 10. Enviar resultado final
    sendProgress(res, 'COMPLETE', 'Informe generado exitosamente', {
      report: reportText,
      reportType,
      rag_used: ragUsed,
      rag_chunks_count: ragChunksCount,
      data_sources: {
        profile: true,
        logs_count: logs.length,
        forms_count: formsForContext.length,
        exams_count: formsForContext.filter((f) =>
          f.form_type === 'EXAM' || f.answers?.some((a: any) => a.questionId === 'exam_type')
        ).length,
        previous_reports_count: previousReports.length,
      },
    });

    res.end();
  } catch (error: any) {
    console.error('❌ Critical Error in report generation:', error?.message || error);

    // Intentar guardar una notificación de error para que el cliente deje de esperar
    try {
      const requestBody = req.body as { userId?: string, reportType?: string } || {};
      const userId = requestBody.userId;
      const reportType = requestBody.reportType || 'REPORT';

      if (userId) {
        const { error: notifErr } = await supabase.from('notifications').insert({
          user_id: userId,
          type: 'REPORT',
          title: `Error: Informe ${reportType}`,
          message: `Hubo un problema al generar tu informe. Por favor intenta de nuevo. Detalles: ${error.message || 'Error desconocido'}`,
          priority: 2,
          is_read: false,
          metadata: {
            report_type: reportType,
            error: true,
            error_message: error.message,
            failed_at: new Date().toISOString()
          }
        });
        if (notifErr) {
          console.error('Failed to save error notification:', notifErr.message);
        } else {
          console.log('✅ Error notification saved for user', userId);
        }
      }
    } catch (notifyError: any) {
      console.error('Exception saving error notification:', notifyError?.message);
    }

    // Solo intentar enviar respuesta si no se han enviado headers todavía
    if (!res.headersSent) {
      try {
        setCORSHeaders(res, origin);
        res.status(500).json({ error: error.message || 'Error al generar el informe' });
      } catch (sendError) {
        console.error('Failed to send error response:', sendError);
      }
    } else {
      // Ya se estaba haciendo streaming, intentar enviar un evento de error y cerrar
      try {
        sendProgress(res, 'ERROR', 'Error al generar el informe', {
          error: error.message || 'Error desconocido',
        });
        res.end();
      } catch (sendError) {
        // Stream ya cerrado, nada que hacer
        console.error('Stream already closed, cannot send error');
      }
    }
  }
}
