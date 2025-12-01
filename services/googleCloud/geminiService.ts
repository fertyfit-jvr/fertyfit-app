/**
 * Gemini Service
 * Servicio centralizado para interactuar con Google Gemini API
 */

import { logger } from '../../lib/logger';

export interface GeminiRequest {
  prompt: string;
  context?: Record<string, any>;
  maxTokens?: number;
  temperature?: number;
}

export interface GeminiResponse {
  text: string;
  error?: string;
}

/**
 * Llama a la API de Gemini a través de la API route de Vercel
 */
export async function callGeminiAPI(request: GeminiRequest): Promise<GeminiResponse> {
  try {
    // Always use full URL - in dev it points to Vercel, in prod it's the same domain
    const vercelUrl = import.meta.env.VITE_VERCEL_URL || import.meta.env.NEXT_PUBLIC_VERCEL_URL || 'https://method.fertyfit.com';
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    const apiUrl = isDev 
      ? `${vercelUrl}/api/gemini/generate`
      : (typeof window !== 'undefined' ? `${window.location.origin}/api/gemini/generate` : '/api/gemini/generate');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        context: request.context,
        maxTokens: request.maxTokens || 200,
        temperature: request.temperature || 0.9,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        text: '',
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      text: data.text || '',
      error: data.error,
    };
  } catch (error) {
    logger.error('❌ Error calling Gemini API:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Genera notificación personalizada para F0
 */
export async function generateF0Notification(profile: {
  name: string;
  age?: number;
  main_objective?: string;
  time_trying?: number | string; // Puede ser número (meses) o string
  diagnoses?: string[];
  partner_status?: string;
}): Promise<string> {
  const seed = new Date().getTime();

  const prompt = `
    Eres un asistente experto en fertilidad y salud femenina (FertyFit).
    La usuaria ${profile.name} acaba de actualizar su perfil.
    
    DATOS ACTUALES:
    - Edad: ${profile.age} años
    - Objetivo Principal: "${profile.main_objective || 'Mejorar salud hormonal'}"
    - Tiempo buscando: ${typeof profile.time_trying === 'number' 
        ? profile.time_trying > 0 
          ? `${profile.time_trying} ${profile.time_trying === 1 ? 'mes' : 'meses'}`
          : 'Recién empezando'
        : (profile.time_trying || 'Recién empezando')}
    - Diagnósticos: ${profile.diagnoses && profile.diagnoses.length > 0 ? profile.diagnoses.join(', ') : 'Ninguno'}
    - Estado Civil: ${profile.partner_status || 'No especificado'}
    - Semilla aleatoria: ${seed}
    
    TAREA:
    Genera un mensaje de notificación ÚNICO y PERSONALIZADO (máximo 40 palabras).
    
    REGLAS OBLIGATORIAS:
    1. MENCIONA EXPLÍCITAMENTE su objetivo ("${profile.main_objective}") o sus diagnósticos si los tiene.
    2. NO repitas frases genéricas como "Bienvenida a FertyFit".
    3. Si tiene diagnósticos (SOP, Endometriosis), valida su esfuerzo.
    4. Si lleva tiempo buscando, dale una frase de esperanza específica.
    5. Usa un tono cercano, como una amiga experta.
    6. Usa emojis variados (no siempre los mismos).
    
    Ejemplo malo: "Bienvenida, estamos aquí para ayudarte."
    Ejemplo bueno: "¡Hola ${profile.name}! Veo que tu meta es ${profile.main_objective}. Con tu diagnóstico de SOP, trabajaremos juntas en tu balance hormonal. 💪✨"
  `;

  const result = await callGeminiAPI({
    prompt,
    maxTokens: 100,
    temperature: 0.9,
  });

  return result.text || (profile.main_objective
    ? `¡Bienvenida! Estamos aquí para acompañarte en tu camino hacia ${profile.main_objective}.`
    : '¡Bienvenida! Estamos aquí para acompañarte en tu camino hacia la fertilidad.');
}

/**
 * Genera análisis de logs diarios (positivo y alerta)
 */
export async function generateLogAnalysis(
  profile: {
    name: string;
    age?: number;
    main_objective?: string;
    diagnoses?: string[];
    time_trying?: number | string; // Puede ser número (meses) o string
    cycle_length?: number;
    cycle_regularity?: string;
  },
  logs: Array<{
    date: string;
    cycleDay?: number;
    bbt?: number;
    mucus?: string;
    stressLevel?: number;
    sleepHours?: number;
    symptoms?: string[];
    lhTest?: boolean;
    alcohol?: boolean;
    veggieServings?: number;
  }>,
  type: 'positive' | 'alert'
): Promise<string> {
  const SYSTEM_CONTEXT = `
Eres un asistente especializado en fertilidad y salud reproductiva femenina. 
Tu objetivo es analizar datos de seguimiento de fertilidad y proporcionar insights personalizados.

IMPORTANTE:
- Usa un tono cálido, empoderador y profesional
- Sé conciso: máximo 2-3 oraciones por insight
- Enfoca en lo ACCIONABLE, no solo en observaciones
- Usa emojis sutiles para hacer el mensaje más amigable
- NUNCA des diagnósticos médicos
- SIEMPRE recomienda consultar con un profesional si hay algo preocupante
  `;

  const profileContext = {
    nombre: profile.name,
    edad: profile.age,
    objetivo: profile.main_objective,
    diagnosticos: profile.diagnoses && profile.diagnoses.length > 0 ? profile.diagnoses.join(', ') : 'Ninguno',
    tiempoBuscando: typeof profile.time_trying === 'number'
      ? profile.time_trying > 0
        ? `${profile.time_trying} ${profile.time_trying === 1 ? 'mes' : 'meses'}`
        : 'No especificado'
      : (profile.time_trying || 'No especificado'),
    cicloPromedio: profile.cycle_length,
    regularidad: profile.cycle_regularity,
  };

  const logSummary = logs.slice(0, 14).map(log => ({
    date: log.date,
    cycleDay: log.cycleDay,
    bbt: log.bbt,
    mucus: log.mucus,
    stress: log.stressLevel,
    sleep: log.sleepHours,
    symptoms: log.symptoms,
    lhTest: log.lhTest,
    alcohol: log.alcohol,
    veggieServings: log.veggieServings,
  }));

  const task = type === 'positive'
    ? 'Analiza los datos considerando el contexto de la usuaria y encuentra UN ASPECTO POSITIVO específico y personalizado. Genera SOLO el mensaje (sin título). Máximo 2-3 oraciones. Tono positivo y motivador.'
    : 'Analiza los datos considerando el contexto de la usuaria y encuentra UN ÁREA DE MEJORA prioritaria y personalizada. Genera SOLO el mensaje (sin título). Máximo 2-3 oraciones. Tono constructivo, no alarmista.';

  const prompt = `${SYSTEM_CONTEXT}

CONTEXTO DE LA USUARIA (F0):
${JSON.stringify(profileContext, null, 2)}

DATOS DE LOS ÚLTIMOS 14 DÍAS:
${JSON.stringify(logSummary, null, 2)}

TAREA: ${task}`;

  const result = await callGeminiAPI({
    prompt,
    maxTokens: 150,
    temperature: 0.8,
  });

  return result.text || '';
}

