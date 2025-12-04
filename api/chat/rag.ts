import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ai } from '../lib/ai.js';
import { applySecurityHeaders } from '../lib/security.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';
import { searchRagDirect } from '../knowledge/search-rag.js';

type PillarCategory = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

type ChatRagRequest = {
  userId: string;
  query: string;
  filters?: {
    pillar_category?: PillarCategory;
    doc_type?: string;
  };
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

type ChatRagResponse = {
  answer: string;
  sources?: Array<{
    document_id: string;
    document_title: string;
    chunk_index: number;
  }>;
  rag_used: boolean;
  rag_chunks_count: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applySecurityHeaders(res);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, query, filters, conversation_history }: ChatRagRequest = req.body || {};

    if (!userId) {
      throw createError('Falta el userId en la solicitud', 400, 'BAD_REQUEST');
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw createError('Falta la pregunta del usuario', 400, 'BAD_REQUEST');
    }

    // Verificar límite diario de chat (5 para free, 30 para premium)
    // TODO: Añadir campo is_premium en profiles cuando implementes premium
    const dailyChatLimit = 5; // Por ahora todos tienen 5, luego se puede ajustar según premium
    
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
        // Continuamos sin límite si falla la verificación
      } else if (count !== null && count >= dailyChatLimit) {
        throw createError(
          `Has alcanzado tu límite diario de ${dailyChatLimit} preguntas. Vuelve mañana o actualiza a premium para más preguntas.`,
          429,
          'DAILY_LIMIT_EXCEEDED'
        );
      }
    } catch (limitError: any) {
      // Si es nuestro error de límite, lo propagamos
      if (limitError.code === 'DAILY_LIMIT_EXCEEDED') {
        throw limitError;
      }
      // Si es otro error, solo lo logueamos y continuamos
      console.warn('Error al verificar límite de chat:', limitError);
    }

    // Obtener contexto RAG
    let ragContext = '';
    let ragSources: Array<{
      document_id: string;
      document_title: string;
      chunk_index: number;
    }> = [];
    let ragUsed = false;
    let ragChunksCount = 0;

    try {
      console.log(`[RAG] Buscando contexto para: "${query.substring(0, 80)}..."`);
      console.log(`[RAG] Filtros:`, filters || 'NINGUNO (búsqueda en todos los pilares)`);

      // Usar función directa en lugar de fetch HTTP para evitar problemas de autenticación
      const ragChunks = await searchRagDirect(query, filters, 5);
      
      console.log(`[RAG] Chunks recibidos: ${ragChunks.length}`);
      
      if (ragChunks.length > 0) {
        ragContext = ragChunks.map((c) => c.content).join('\n\n');
        ragChunksCount = ragChunks.length;
        ragSources = ragChunks
          .map((c) => ({
            document_id: c.metadata?.document_id || '',
            document_title: c.metadata?.document_title || '',
            chunk_index: c.metadata?.chunk_index || 0,
          }))
          .filter((s) => s.document_id);
        ragUsed = ragContext.length > 0;
        
        if (ragUsed) {
          console.log(`✅ RAG usado en chat: ${ragChunksCount} chunks encontrados para query: "${query.substring(0, 50)}..."`);
        }
      } else {
        console.warn(`⚠️ RAG NO disponible en chat: No se encontraron chunks para query: "${query.substring(0, 50)}..."`);
      }
    } catch (ragError: any) {
      // Si falla el RAG, continuamos sin él (pero avisamos)
      console.error('❌ RAG EXCEPTION en chat:', ragError?.message || ragError);
      console.error('Stack:', ragError?.stack);
    }

    // Construir prompt para Gemini
    const historyText = conversation_history
      ? conversation_history
          .map((msg) => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
          .join('\n')
      : '';

    const prompt = `
Eres el consultor experto de FertyFit.
${ragContext ? `IMPORTANTE: Solo puedes usar la información del siguiente contexto, que proviene de la metodología FertyFit.
Si la pregunta no se puede responder con este contexto, dilo explícitamente.
NO uses conocimiento general que no esté en este contexto.

CONTEXTO FERTYFIT (${ragChunksCount} fragmentos de documentación):
${ragContext}

` : 'Responde basándote en tu conocimiento general sobre fertilidad y salud femenina, pero siempre desde la perspectiva de FertyFit.\n\n'}
${historyText ? `HISTORIAL DE CONVERSACIÓN:
${historyText}

` : ''}PREGUNTA DEL USUARIO:
${query}

Responde en español, de forma clara, empática y sin dar diagnósticos médicos.
${ragContext ? 'Recuerda: Solo usa la información del contexto FertyFit proporcionado arriba.' : ''}
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
      console.error(`[CHAT] Stack:`, geminiError?.stack);
      throw createError(
        `Error al generar respuesta: ${geminiError?.message || 'Error desconocido'}`,
        500,
        'GEMINI_ERROR'
      );
    }

    // Guardar la interacción de chat en notifications
    try {
      // Obtener historial reciente para metadata (últimas 5 interacciones de hoy)
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
            input: { query, filters },
            sources: ragSources,
            rag_used: ragUsed,
            rag_chunks_count: ragChunksCount,
            rag_context_length: ragContext.length,
            conversation_turn: conversationTurn,
            generated_at: new Date().toISOString(),
          },
        });

      if (saveError) {
        console.warn('No se pudo guardar el chat en notifications:', saveError);
        // No fallamos la request si falla el guardado
      }
    } catch (saveError) {
      console.warn('Error al guardar chat en notifications:', saveError);
      // No fallamos la request si falla el guardado
    }

    const responseData: ChatRagResponse = {
      answer,
      rag_used: ragUsed,
      rag_chunks_count: ragChunksCount,
      ...(ragSources.length > 0 && { sources: ragSources }),
    };

    return res.status(200).json(responseData);
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}

