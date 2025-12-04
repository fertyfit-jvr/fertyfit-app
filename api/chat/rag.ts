import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ai } from '../../server/lib/ai.js';
import { applySecurityHeaders } from '../../server/lib/security.js';
import { sendErrorResponse, createError } from '../../server/lib/errorHandler.js';

type ChatRequest = {
  userId: string;
  query: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
};

// Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL o SERVICE ROLE KEY no están configuradas en las variables de entorno');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type ChatResponse = {
  answer: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applySecurityHeaders(res);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, query, conversation_history }: ChatRequest = req.body || {};

    if (!userId) {
      throw createError('Falta el userId en la solicitud', 400, 'BAD_REQUEST');
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw createError('Falta la pregunta del usuario', 400, 'BAD_REQUEST');
    }

    // Verificar límite diario de chat (5 para free)
    const dailyChatLimit = 5;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'CHAT')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      if (countError) {
        console.warn('Error al verificar límite diario de chat:', countError);
      } else if (count !== null && count >= dailyChatLimit) {
        throw createError(
          `Has alcanzado tu límite diario de ${dailyChatLimit} preguntas. Vuelve mañana o actualiza a premium para más preguntas.`,
          429,
          'DAILY_LIMIT_EXCEEDED'
        );
      }
    } catch (limitError: any) {
      if (limitError.code === 'DAILY_LIMIT_EXCEEDED') {
        throw limitError;
      }
      console.warn('Error al verificar límite de chat:', limitError);
    }

    // Construir prompt para Gemini (SIN RAG - respuestas cortas)
    const historyText = conversation_history
      ? conversation_history
          .map((msg) => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
          .join('\n')
      : '';

    const prompt = `
Eres el consultor experto de FertyFit, una metodología integral de fertilidad basada en 4 pilares: FUNCIÓN (hormonal), FLORA (microbiota), FOOD (nutrición) y FLOW (bienestar).

INSTRUCCIONES CRÍTICAS:
- Responde en MÁXIMO 2 párrafos cortos (3-4 líneas cada uno)
- Sé directo, claro y conciso
- NO des diagnósticos médicos ni prescribas tratamientos
- Si requiere diagnóstico médico, orienta a consultar con un especialista
- Usa un tono cercano pero profesional
- Si no estás seguro, dilo brevemente

${historyText ? `HISTORIAL DE CONVERSACIÓN:\n${historyText}\n\n` : ''}
PREGUNTA DEL USUARIO:
${query}

Responde en máximo 2 párrafos cortos. Sé conciso y directo.
`;

    let answer = 'No se pudo generar una respuesta.';
    
    try {
      console.log(`[CHAT] Generando respuesta con Gemini para query: "${query.substring(0, 50)}..."`);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: prompt },
        ],
      } as any);

      answer = (response as any).text ?? 'No se pudo generar una respuesta.';
      console.log(`[CHAT] Respuesta generada exitosamente (${answer.length} caracteres)`);
    } catch (geminiError: any) {
      console.error(`[CHAT] ERROR al generar respuesta con Gemini:`, geminiError?.message || geminiError);
      throw createError(
        `Error al generar respuesta: ${geminiError?.message || 'Error desconocido'}`,
        500,
        'GEMINI_ERROR'
      );
    }

    // Guardar la interacción de chat en notifications
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: recentChats } = await supabase
        .from('notifications')
        .select('message, metadata')
        .eq('user_id', userId)
        .eq('type', 'CHAT')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .order('created_at', { ascending: false })
        .limit(5);

      const conversationTurn = (recentChats?.length || 0) + 1;

      const { error: saveError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'CHAT',
          title: 'Consulta FertyFit',
          message: answer,
          priority: 1,
          is_read: false,
          metadata: {
            input: { query },
            conversation_turn: conversationTurn,
            generated_at: new Date().toISOString(),
          },
        });

      if (saveError) {
        console.warn('No se pudo guardar el chat en notifications:', saveError);
      }
    } catch (saveError) {
      console.warn('Error al guardar chat en notifications:', saveError);
    }

    const responseData: ChatResponse = {
      answer,
    };

    return res.status(200).json(responseData);
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}
