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

    const { userId, reportType = '360', labsScope = 'LAST' } = req.body as {
      userId?: string;
      reportType?: ReportType;
      labsScope?: 'LAST' | 'ALL';
    };

    if (!userId) {
      throw createError('Falta el userId en la solicitud', 400, 'BAD_REQUEST');
    }

    // Validar reportType
    if (!['360', 'BASIC', 'DAILY', 'LABS'].includes(reportType)) {
      throw createError('Tipo de informe inválido', 400, 'INVALID_REPORT_TYPE');
    }

    // 0. REGLAS ESTRICTAS DE GENERACIÓN AUTOMÁTICA
    // Solo para reportType = 'BASIC', que se dispara automáticamente
    if (reportType === 'BASIC') {
      // A. LÍMITE MENSUAL: Máximo 2 informes básicos automáticos por mes
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthlyCount, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'REPORT')
        .contains('metadata', { report_type: 'BASIC' })
        .gte('created_at', startOfMonth.toISOString());

      if (monthlyCount !== null && monthlyCount >= 2) {
        logger.info(`[REPORT_BLOCKED] Límite mensual alcanzado para usuario ${userId}. Count: ${monthlyCount}`);
        res.status(200).json({
          message: 'Monthly limit reached (max 2/month)',
          skipped: true,
          reason: 'MONTHLY_LIMIT'
        });
        return res.end();
      }

      // B. VERIFICACIÓN DE DATOS NUEVOS: Solo generar si hay datos MÁS NUEVOS que el último informe
      // 1. Obtener fecha del último informe básico
      const { data: lastReport } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('user_id', userId)
        .eq('type', 'REPORT')
        .contains('metadata', { report_type: 'BASIC' })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastReport) {
        const lastReportDate = new Date(lastReport.created_at).getTime();

        // 2. Obtener fecha de última modificación de CUALQUIER formulario (F0, Function, etc.)
        const { data: latestForm } = await supabase
          .from('consultation_forms')
          .select('submitted_at, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false }) // Check updated_at (updates)
          .limit(1)
          .single();

        // Check submitted_at as well (new creations)
        const { data: latestSubmission } = await supabase
          .from('consultation_forms')
          .select('submitted_at')
          .eq('user_id', userId)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .single();

        const latestFormUpdate = Math.max(
          latestForm?.updated_at ? new Date(latestForm.updated_at).getTime() : 0,
          latestSubmission?.submitted_at ? new Date(latestSubmission.submitted_at).getTime() : 0
        );

        // Si el informe es más reciente que el último dato modificado, NO generar nuevo
        // Añadimos un margen de 1 minuto para evitar condiciones de carrera donde se guardan casi a la vez
        if (lastReportDate >= latestFormUpdate - 60000) {
          logger.info(`[REPORT_BLOCKED] No hay datos nuevos para usuario ${userId}. Report: ${lastReport.created_at}, Data: ${new Date(latestFormUpdate).toISOString()}`);
          res.status(200).json({
            message: 'No new data to analyze',
            skipped: true,
            reason: 'NO_NEW_DATA'
          });
          return res.end();
        }
      }
      // Si no hay reportes anteriores (first time), pasa y se genera.
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
      email: undefined,
      name: profile.name || 'Paciente',
      joinedAt: profile.created_at,
      methodStartDate: profile.method_start_date || undefined,
      age: profile.age || 0,
      weight: profile.weight || 0,
      height: profile.height || 0,
      treatments: [],
      disclaimerAccepted: profile.disclaimer_accepted ?? false,
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

    // 2. Registros diarios (solo si es necesario)
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
