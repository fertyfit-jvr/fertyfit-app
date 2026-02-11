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
} from './report-helpers.js';
import { canGenerateBasic } from './reportRules.js';
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
      supplements: profile.supplements || undefined,
      smoker: profile.smoker || undefined,
      alcoholConsumption: profile.alcohol_consumption || undefined,
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

    // 2. Registros diarios (usados en 360, DAILY y también para resumen médico en BASIC)
    let logs: DailyLog[] = [];
    if (reportType === '360' || reportType === 'DAILY' || reportType === 'BASIC') {
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
        .limit(3);

      if (!reportsError && reportsData) {
        previousReports = reportsData as AppNotification[];
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
      ragChunks = await searchRagDirect(ragQuery, undefined, 15);

      if (ragChunks.length > 0) {
        ragChunksCount = ragChunks.length;
        ragContext = ragChunks.map((c) => c.content).join('\n\n');
        ragUsed = ragContext.length > 0;
      }
    } catch (ragError: any) {
      logger.error('RAG EXCEPTION en informe:', ragError?.message || ragError);
      // Continuamos sin RAG
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

    // 8. Generar informe con Gemini
    sendProgress(res, 'GENERATING', 'Generando tu informe personalizado con IA...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }, { text: JSON.stringify(context) }],
    } as any);

    // Validar respuesta de Gemini
    let reportText: string;
    if (response && typeof response === 'object') {
      const responseText = (response as { text?: string }).text;
      if (typeof responseText === 'string' && responseText.length > 0) {
        reportText = responseText;
      } else {
        logger.error('Respuesta de Gemini sin texto válido para informe');
        reportText = 'No se pudo generar el informe. Por favor, intenta de nuevo.';
      }
    } else {
      logger.error('Respuesta de Gemini inválida para informe');
      reportText = 'No se pudo generar el informe. Por favor, intenta de nuevo.';
    }

    // 9. Guardar el informe en notifications
    try {
      const baseTitle =
        reportType === 'LABS' ? 'Informe de Analíticas' : getReportTitle(reportType);
      const reportTitle = `${baseTitle} - ${new Date().toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'REPORT',
        title: reportTitle,
        message: reportText,
        priority: 1,
        is_read: false,
        metadata: {
          report_type: reportType,
          format: 'markdown',
          manual_trigger: manualTrigger, // Flag para distinguir manual vs automático
          // Resúmenes para generación de HTML estructurado en frontend
          user_profile_summary:
            reportType === 'BASIC' || reportType === '360' ? userProfileSummary : undefined,
          cycle_info:
            reportType === 'BASIC' || reportType === '360' ? cycleInfo : undefined,
          fertyscore:
            reportType === 'BASIC' || reportType === '360' ? fertyScoreSummary : undefined,
          basic_forms: reportType === 'BASIC' ? serializedForms : undefined,
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
      });
    } catch (saveError) {
      logger.warn('Error al guardar informe en notifications:', saveError);
      // No fallamos la request si falla el guardado
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
    // Aseguramos CORS también en errores
    setCORSHeaders(res, origin);

    // Intentar enviar error como progreso antes de cerrar
    try {
      sendProgress(res, 'ERROR', 'Error al generar el informe', {
        error: error.message || 'Error desconocido',
      });
      res.end();
    } catch (sendError) {
      // Si falla el envío de progreso, usar respuesta JSON tradicional
      sendErrorResponse(res, error, req);
    }
  }
}
