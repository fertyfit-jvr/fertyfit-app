import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ai } from '../lib/ai.js';
import { applySecurityHeaders } from '../lib/security.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';

import type { PillarFunction, PillarFood, PillarFlora, PillarFlow } from '../../types/pillars.js';
import type { UserProfile, DailyLog, ConsultationForm } from '../../types.js';


// Supabase client para entorno serverless (usar process.env, no import.meta.env)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL o ANON KEY no están configuradas en las variables de entorno');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applySecurityHeaders(res);

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

    // 4. Pilares actuales (tablas pillar_*)
    const [
      { data: functionData, error: functionError },
      { data: foodData, error: foodError },
      { data: floraData, error: floraError },
      { data: flowData, error: flowError },
    ] = await Promise.all([
      supabase.from('pillar_function').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('pillar_food').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('pillar_flora').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('pillar_flow').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (functionError || foodError || floraError || flowError) {
      console.error('Error cargando pilares', {
        functionError,
        foodError,
        floraError,
        flowError,
      });
    }

    const pillars = {
      function: (functionData as PillarFunction) || null,
      food: (foodData as PillarFood) || null,
      flora: (floraData as PillarFlora) || null,
      flow: (flowData as PillarFlow) || null,
    };

    // 5. Cálculo de FertyScore (total + por pilar)

    // 6. Construir contexto para Gemini
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
      pilares: {
        function: pillars.function,
        food: pillars.food,
        flora: pillars.flora,
        flow: pillars.flow,
      },
      registros_diarios: logs,
      formularios: forms,
      fecha_informe: new Date().toISOString(),
    };

    const prompt = `
Eres un experto en fertilidad y salud integral femenina.

Recibirás un JSON con:
- Perfil de la usuaria.
- Estado actual de sus pilares (FUNCTION, FOOD, FLORA, FLOW).
- Historial de registros diarios (temperatura, moco, sueño, estrés, hábitos).
- Formularios y exámenes médicos guardados.
- Información clínica relevante de los pilares (FUNCTION, FOOD, FLORA, FLOW).

TAREA:
1. Lee el JSON y construye un INFORME NARRATIVO COMPLETO para la usuaria.
2. Estructura el informe en secciones con subtítulos claros, por ejemplo:
   - Perfil general y contexto.
   - Resumen de fertilidad general.
   - Análisis del pilar FUNCTION (fisiología, analíticas, diagnósticos).
   - Análisis del pilar FOOD (nutrición y hábitos).
   - Análisis del pilar FLORA (microbiota, digestivo, infecciones).
   - Análisis del pilar FLOW (estrés, sueño, carga mental, sexualidad).
   - Síntesis de riesgos y fortalezas.
   - Recomendaciones prácticas (3–5 puntos concretos).

3. Usa un tono empático, claro y no alarmista.
4. No inventes diagnósticos médicos; describe riesgos y patrones como "sugiere", "podría indicar".
5. Escribe TODO el informe en español y dirigido en segunda persona ("tú").

A continuación tienes el JSON de contexto:
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        { text: JSON.stringify(context) },
      ],
    } as any);

    const reportText = (response as any).text ?? 'No se pudo generar el informe.';

    return res.status(200).json({
      report: reportText,
    });
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}
