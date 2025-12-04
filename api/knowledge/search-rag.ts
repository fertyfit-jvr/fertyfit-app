import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ai } from '../../server/lib/ai.js';
import { applySecurityHeaders } from '../../server/lib/security.js';
import { sendErrorResponse, createError } from '../../server/lib/errorHandler.js';

export type PillarCategory = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

type SearchRagRequest = {
  query?: string;
  filters?: {
    pillar_category?: PillarCategory;
    doc_type?: string;
    document_id?: string;
  };
  limit?: number;
};

export type KnowledgeChunk = {
  content: string;
  metadata: Record<string, any>;
  similarity_score?: number;
};

type SearchRagResponse = {
  chunks: KnowledgeChunk[];
};

// Supabase client (igual patrón que en report-extended)
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

async function embedQuery(query: string): Promise<number[]> {
  try {
    console.log(`[RAG] Generando embedding para: "${query.substring(0, 80)}..."`);
    
    // El SDK nuevo usa ai.models.embedContent directamente
    const resp = await (ai as any).models.embedContent({
      model: 'text-embedding-004',
      contents: [query], // Array de strings
    });

    // La respuesta tiene embeddings array, cada uno con values
    const embedding =
      resp?.embeddings?.[0]?.values;

    if (!embedding || embedding.length === 0) {
      console.error(`[RAG] ERROR: Embedding vacío o inválido`);
      throw createError('No se pudo generar el embedding de la consulta', 500, 'EMBEDDING_ERROR');
    }

    console.log(`[RAG] Embedding OK: ${embedding.length} dimensiones`);
    return embedding;
  } catch (error: any) {
    console.error(`[RAG] ERROR en embedding:`, error?.message || error);
    throw error;
  }
}

// Función exportable para usar directamente desde otros endpoints
export async function searchRagDirect(
  query: string,
  filters?: {
    pillar_category?: PillarCategory;
    doc_type?: string;
    document_id?: string;
  },
  limit: number = 5
): Promise<KnowledgeChunk[]> {
  const matchCount = Math.min(Math.max(limit, 1), 20); // 1–20

  // 1) Obtener embedding de la query
  const queryEmbedding = await embedQuery(query);

  // 2) Llamar a la función RPC en Supabase
  console.log(`[RAG] Llamando RPC match_fertyfit_knowledge con match_count=${matchCount}`);
  console.log(`[RAG] Filtros: pillar_category=${filters?.pillar_category || 'null'}, doc_type=${filters?.doc_type || 'null'}, document_id=${filters?.document_id || 'null'}`);
  
  const { data, error } = await supabase.rpc('match_fertyfit_knowledge', {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    filter_pillar_category: filters?.pillar_category ?? null,
    filter_doc_type: filters?.doc_type ?? null,
    filter_document_id: filters?.document_id ?? null,
  });

  if (error) {
    console.error(`[RAG] ERROR en RPC:`, error);
    throw error;
  }

  console.log(`[RAG] RPC devolvió ${data?.length || 0} resultados`);
  if (data && data.length > 0) {
    console.log(`[RAG] Primer resultado: similarity=${data[0]?.similarity}, doc_id=${data[0]?.document_id}, chunk_id=${data[0]?.chunk_id}`);
  }

  const chunks: KnowledgeChunk[] =
    (data || []).map((row: any) => ({
      content: row.content_chunk,
      metadata: row.metadata_json,
      similarity_score: typeof row.similarity === 'number' ? row.similarity : undefined,
    })) ?? [];

  // Logging para verificar que RAG funciona
  if (chunks.length > 0) {
    console.log(`✅ RAG search exitoso: ${chunks.length} chunks encontrados para query: "${query.substring(0, 50)}..."`);
    console.log(`   Filtros aplicados: pillar_category=${filters?.pillar_category || 'ninguno'}, doc_type=${filters?.doc_type || 'ninguno'}`);
  } else {
    console.warn(`⚠️ RAG search sin resultados: No se encontraron chunks para query: "${query.substring(0, 50)}..."`);
    console.warn(`   Filtros aplicados: pillar_category=${filters?.pillar_category || 'ninguno'}, doc_type=${filters?.doc_type || 'ninguno'}`);
  }

  return chunks;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applySecurityHeaders(res);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, filters, limit }: SearchRagRequest = req.body || {};

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw createError('Falta la query de búsqueda', 400, 'BAD_REQUEST');
    }

    // Usar la función directa para evitar problemas de autenticación
    const chunks = await searchRagDirect(query, filters, limit ?? 5);

    const response: SearchRagResponse = {
      chunks,
    };

    return res.status(200).json(response);
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}
