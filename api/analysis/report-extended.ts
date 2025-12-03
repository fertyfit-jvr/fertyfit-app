import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai } from '../lib/ai.js';
import { applySecurityHeaders } from '../lib/security.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';

import { fetchProfileForUser, fetchAllLogsForUser, fetchUserFormsForUser } from '../../services/userDataService.js';
import { fetchPillarData } from '../../services/pillarService.js';
import { calculateFertyScore, type FertyPillars } from '../../services/fertyscoreService.js';
import type { PillarFunction, PillarFood, PillarFlora, PillarFlow } from '../../types/pillars.js';
import type { UserProfile, DailyLog, ConsultationForm } from '../../types.js';

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

    // 1. Perfil
    const profile = await fetchProfileForUser(userId);
    if (!profile) {
      throw createError('No se encontró el perfil de la usuaria', 404, 'PROFILE_NOT_FOUND');
    }

    // Mapear a UserProfile mínimo para FertyScore (simplificado)
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

    // 2. Registros diarios (historial completo)
    const logsResult = await fetchAllLogsForUser(userId);
    const logs: DailyLog[] = logsResult.success ? logsResult.data : [];

    // 3. Formularios / exámenes (consultation_forms)
    const formsResult = await fetchUserFormsForUser(userId);
    const forms: ConsultationForm[] = formsResult.success ? formsResult.data : [];

    // 4. Pilares actuales
    const [functionData, foodData, floraData, flowData] = await Promise.all([
      fetchPillarData<PillarFunction>(userId, 'FUNCTION'),
      fetchPillarData<PillarFood>(userId, 'FOOD'),
      fetchPillarData<PillarFlora>(userId, 'FLORA'),
      fetchPillarData<PillarFlow>(userId, 'FLOW'),
    ]);

    const pillars: FertyPillars = {
      function: functionData,
      food: foodData,
      flora: floraData,
      flow: flowData,
    };

    // 5. Cálculo de FertyScore (total + por pilar)
    const scores = calculateFertyScore(userProfile, logs, pillars);

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
        function: functionData,
        food: foodData,
        flora: floraData,
        flow: flowData,
      },
      registros_diarios: logs,
      formularios: forms,
      fertyScore: scores,
      fecha_informe: new Date().toISOString(),
    };

    const prompt = `
Eres un experto en fertilidad y salud integral femenina.

Recibirás un JSON con:
- Perfil de la usuaria.
- Estado actual de sus pilares (FUNCTION, FOOD, FLORA, FLOW).
- Historial de registros diarios (temperatura, moco, sueño, estrés, hábitos).
- Formularios y exámenes médicos guardados.
- FertyScore total y por pilar.

TAREA:
1. Lee el JSON y construye un INFORME NARRATIVO COMPLETO para la usuaria.
2. Estructura el informe en secciones con subtítulos claros, por ejemplo:
   - Perfil general y contexto.
   - Resumen de fertilidad y FertyScore.
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


