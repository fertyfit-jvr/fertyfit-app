import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ai } from '../../server/lib/ai.js';
import { applySecurityHeaders } from '../../server/lib/security.js';
import { sendErrorResponse, createError } from '../../server/lib/errorHandler.js';
import { searchRagDirect } from '../../server/lib/ragUtils.js';

import type { UserProfile, DailyLog, ConsultationForm } from '../../types.js';

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

    const { userId } = req.body as { userId?: string };

    if (!userId) {
      throw createError('Falta el userId en la solicitud', 400, 'BAD_REQUEST');
    }

    // 1. Perfil (tabla profiles)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw createError('No se encontró el perfil de la usuaria', 404, 'PROFILE_NOT_FOUND');
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

    // 2. Registros diarios (tabla daily_logs)
    const { data: logsData, error: logsError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (logsError) {
      throw createError('Error al cargar los registros diarios', 500, 'LOGS_ERROR');
    }

    const logs: DailyLog[] =
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

    // 3. Formularios / exámenes (tabla consultation_forms)
    const { data: formsData, error: formsError } = await supabase
      .from('consultation_forms')
      .select('*')
      .eq('user_id', userId);

    if (formsError) {
      throw createError('Error al cargar los formularios', 500, 'FORMS_ERROR');
    }

    const forms: ConsultationForm[] = (formsData as ConsultationForm[]) || [];

    // Construir contexto para Gemini (sin FertyScore ni pilares)
    const context = {
      perfil: {
        id: userProfile.id,
        nombre: userProfile.name,
        edad: userProfile.age,
        peso: userProfile.weight,
        altura: userProfile.height,
        objetivo: userProfile.mainObjective,
        estado_pareja: userProfile.partnerStatus,
        ciclo: {
          longitud: userProfile.cycleLength,
          regularidad: userProfile.cycleRegularity,
          ultima_regla: userProfile.lastPeriodDate,
          historial_reglas: userProfile.periodHistory,
        },
        diagnosticos: userProfile.diagnoses,
        tratamientos_fertilidad: userProfile.fertilityTreatments,
        suplementos: userProfile.supplements,
        consumo_alcohol: userProfile.alcoholConsumption,
        fumadora: userProfile.smoker,
      },
      registros_diarios: logs,
      formularios: forms,
      fecha_informe: new Date().toISOString(),
    };

    // Obtener contexto metodológico FertyFit desde RAG
    let ragContext = '';
    let ragChunks: Array<{ content: string; metadata?: Record<string, any> }> = [];
    let ragUsed = false;
    let ragChunksCount = 0;

    try {
      const ragQuery = `contexto metodológico FertyFit para un informe integral de fertilidad de una paciente de ${userProfile.age} años`;
      
      console.log(`[RAG] Buscando contexto para informe de paciente ${userProfile.age} años`);
      console.log(`[RAG] Query: "${ragQuery}"`);
      console.log(`[RAG] Buscando sin filtros restrictivos (todos los documentos)`);
      
      // Buscar sin filtros restrictivos - los documentos no tienen doc_type='Informe_Global' exacto
      // La búsqueda vectorial encontrará los documentos más relevantes automáticamente
      ragChunks = await searchRagDirect(ragQuery, undefined, 5);
      
      console.log(`[RAG] Chunks recibidos: ${ragChunks.length}`);
      
      if (ragChunks.length > 0) {
        ragChunksCount = ragChunks.length;
        ragContext = ragChunks.map((c) => c.content).join('\n\n');
        ragUsed = ragContext.length > 0;
        
        if (ragUsed) {
          console.log(`✅ RAG usado en informe: ${ragChunksCount} chunks encontrados para informe de paciente ${userProfile.age} años`);
        }
      } else {
        console.warn(`⚠️ RAG NO disponible en informe: No se encontraron chunks para informe de paciente ${userProfile.age} años`);
      }
    } catch (ragError: any) {
      // Si falla el RAG, continuamos sin él (no rompemos el informe)
      console.error('❌ RAG EXCEPTION en informe:', ragError?.message || ragError);
      console.error('Stack:', ragError?.stack);
    }

    const prompt = `
Eres un experto en fertilidad y salud integral femenina siguiendo la metodología FertyFit.

${ragContext ? `IMPORTANTE: Solo puedes usar la información del siguiente contexto, que proviene de la metodología FertyFit.
NO uses conocimiento general que no esté en este contexto.
PRIORIZA SIEMPRE el contexto metodológico FertyFit sobre cualquier conocimiento general.
Si la información no está en este contexto, dilo explícitamente.

CONTEXTO METODOLÓGICO FERTYFIT (${ragChunksCount} fragmentos de documentación - fuente autorizada):
${ragContext}

` : ''}DATOS DE LA PACIENTE:
Recibirás un JSON con:
- Perfil de la usuaria.
- Historial de registros diarios (temperatura, moco, sueño, estrés, hábitos).
- Formularios y exámenes médicos guardados (incluyendo analíticas y ecografías).

TAREA:
1. Lee el JSON y construye un INFORME NARRATIVO COMPLETO para la usuaria.
2. Estructura el informe en secciones con subtítulos claros, por ejemplo:
   - Perfil general y contexto.
   - Resumen de fertilidad general.
   - Análisis de exámenes y datos médicos relevantes.
   - Hábitos y estilo de vida (sueño, estrés, actividad, alimentación si está disponible).
   - Síntesis de riesgos y fortalezas.
   - Recomendaciones prácticas (3–5 puntos concretos).

3. ${ragContext ? 'Recuerda: Solo usa la información del contexto FertyFit proporcionado arriba. ' : ''}Usa un tono empático, claro y no alarmista.
4. No inventes diagnósticos médicos; describe riesgos y patrones como "sugiere", "podría indicar".
5. Escribe TODO el informe en español y dirigido en segunda persona ("tú").

A continuación tienes el JSON de contexto de la paciente:
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        { text: JSON.stringify(context) },
      ],
    } as any);

    // Validar respuesta de Gemini de forma segura (preservar contexto RAG)
    let reportText: string;
    if (response && typeof response === 'object') {
      const responseText = (response as { text?: string }).text;
      if (typeof responseText === 'string' && responseText.length > 0) {
        reportText = responseText;
      } else {
        console.error('❌ Respuesta de Gemini sin texto válido para informe:', {
          hasText: 'text' in response,
          textType: typeof (response as { text?: unknown }).text,
          responseKeys: Object.keys(response),
        });
        reportText = 'No se pudo generar el informe. Por favor, intenta de nuevo.';
      }
    } else {
      console.error('❌ Respuesta de Gemini inválida para informe:', typeof response);
      reportText = 'No se pudo generar el informe. Por favor, intenta de nuevo.';
    }

    // Guardar el informe en notifications
    try {
      const { error: saveError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'REPORT',
          title: `Informe 360º - ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          message: reportText,
          priority: 1,
          is_read: false,
          metadata: {
            input: { userId },
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

      if (saveError) {
        console.warn('No se pudo guardar el informe en notifications:', saveError);
        // No fallamos la request si falla el guardado
      }
    } catch (saveError) {
      console.warn('Error al guardar informe en notifications:', saveError);
      // No fallamos la request si falla el guardado
    }

    return res.status(200).json({
      report: reportText,
      rag_used: ragUsed,
      rag_chunks_count: ragChunksCount,
    });
  } catch (error) {
    // Aseguramos CORS también en errores
    setCORSHeaders(res, origin);
    sendErrorResponse(res, error, req);
  }
}

