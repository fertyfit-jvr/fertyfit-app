import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai } from '../lib/ai.js';
import { applySecurityHeaders } from '../lib/security.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';

type PillarCategory = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

type ChatRagRequest = {
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

type ChatRagResponse = {
  answer: string;
  sources?: Array<{
    document_id: string;
    document_title: string;
    chunk_index: number;
  }>;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applySecurityHeaders(res);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, filters, conversation_history }: ChatRagRequest = req.body || {};

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw createError('Falta la pregunta del usuario', 400, 'BAD_REQUEST');
    }

    // Obtener contexto RAG
    let ragContext = '';
    let ragSources: Array<{
      document_id: string;
      document_title: string;
      chunk_index: number;
    }> = [];

    try {
      const vercelUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const ragResponse = await fetch(`${vercelUrl}/api/knowledge/search-rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          filters,
          limit: 5,
        }),
      });

      if (ragResponse.ok) {
        const ragData = (await ragResponse.json()) as {
          chunks?: Array<{
            content: string;
            metadata?: Record<string, any>;
          }>;
        };
        if (ragData.chunks && ragData.chunks.length > 0) {
          ragContext = ragData.chunks.map((c) => c.content).join('\n\n');
          ragSources = ragData.chunks
            .map((c) => ({
              document_id: c.metadata?.document_id || '',
              document_title: c.metadata?.document_title || '',
              chunk_index: c.metadata?.chunk_index || 0,
            }))
            .filter((s) => s.document_id);
        }
      }
    } catch (ragError) {
      // Si falla el RAG, continuamos sin él (pero avisamos)
      console.warn('No se pudo obtener contexto RAG:', ragError);
    }

    // Construir prompt para Gemini
    const historyText = conversation_history
      ? conversation_history
          .map((msg) => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
          .join('\n')
      : '';

    const prompt = `
Eres el consultor experto de FertyFit.
${ragContext ? `Solo puedes usar la información del siguiente contexto, que proviene de la metodología FertyFit.
Si la pregunta no se puede responder con este contexto, dilo explícitamente.

CONTEXTO FERTYFIT:
${ragContext}

` : 'Responde basándote en tu conocimiento general sobre fertilidad y salud femenina, pero siempre desde la perspectiva de FertyFit.\n\n'}
${historyText ? `HISTORIAL DE CONVERSACIÓN:
${historyText}

` : ''}PREGUNTA DEL USUARIO:
${query}

Responde en español, de forma clara, empática y sin dar diagnósticos médicos.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
      ],
    } as any);

    const answer = (response as any).text ?? 'No se pudo generar una respuesta.';

    const responseData: ChatRagResponse = {
      answer,
      ...(ragSources.length > 0 && { sources: ragSources }),
    };

    return res.status(200).json(responseData);
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}

