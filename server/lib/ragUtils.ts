import { createClient } from '@supabase/supabase-js';
import { ai } from './ai.js';
import { createError } from './errorHandler.js';
import { logger } from './logger.js';

export type PillarCategory = 'FUNCTION' | 'FOOD' | 'FLORA' | 'FLOW';

export type KnowledgeChunk = {
  content: string;
  metadata: Record<string, any>;
  similarity_score?: number;
};

// Función helper para obtener cliente de Supabase
function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase URL o SERVICE ROLE KEY no están configuradas en las variables de entorno');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function embedQuery(query: string): Promise<number[]> {
  try {
    console.log(`[RAG] Generando embedding para: "${query.substring(0, 80)}..."`);

    // Use models/gemini-embedding-001 to match existing database vectors (3072 dimensions)
    const resp = await (ai as any).models.embedContent({
      model: 'models/gemini-embedding-001',
      contents: query,
    });

    console.log('[RAG] Embedding response keys:', resp ? Object.keys(resp) : 'null');

    // Handle different SDK response formats (.embedding.values or .embeddings[0].values)
    const embedding =
      (resp as any)?.embedding?.values ??
      (resp as any)?.embeddings?.[0]?.values;

    if (!embedding || embedding.length === 0) {
      logger.error(`[RAG] ERROR: Embedding vacío o inválido`);
      throw createError('No se pudo generar el embedding de la consulta', 500, 'EMBEDDING_ERROR');
    }

    logger.log(`[RAG] Embedding OK: ${embedding.length} dimensiones`);
    return embedding;
  } catch (error: any) {
    logger.error(`[RAG] ERROR en embedding:`, error?.message || error);
    throw error;
  }
}

export async function searchRagDirect(
  query: string,
  filters?: {
    pillar_category?: PillarCategory;
    doc_type?: string;
    document_id?: string;
  },
  limit: number = 15
): Promise<KnowledgeChunk[]> {
  // Aumentamos significativamente el match_count inicial para tener suficiente pool para filtrar
  // Si pedimos 15, traemos 100 para asegurar diversidad.
  const initialFetchCount = Math.max(limit * 8, 80);
  const desiredCount = Math.min(Math.max(limit, 1), 30);

  // 1) Obtener embedding de la query
  const queryEmbedding = await embedQuery(query);

  // 2) Llamar a la función RPC en Supabase con un límite mayor
  const supabase = getSupabaseClient();
  logger.log(`[RAG] Llamando RPC match_fertyfit_knowledge con match_count=${initialFetchCount} (solicitados finales: ${desiredCount})`);

  const { data, error } = await supabase.rpc('match_fertyfit_knowledge', {
    query_embedding: queryEmbedding,
    match_count: initialFetchCount,
    filter_pillar_category: filters?.pillar_category ?? null,
    filter_doc_type: filters?.doc_type ?? null,
    filter_document_id: filters?.document_id ?? null,
  });

  if (error) {
    logger.error(`[RAG] ERROR en RPC:`, error);
    throw error;
  }

  let rawResults = data || [];
  logger.log(`[RAG] RPC devolvió ${rawResults.length} resultados crudos`);

  // Si no hay resultados, hacer fallback al documento core de metodología
  const PINNED_DOC_ID = 'FERTYFIT_METODOLOGIA_CORE.md';
  if (rawResults.length === 0) {
    logger.warn(`[RAG] No se encontraron resultados, haciendo fallback a ${PINNED_DOC_ID}`);
    const { data: fallbackData, error: fallbackError } = await supabase.rpc('match_fertyfit_knowledge', {
      query_embedding: queryEmbedding,
      match_count: desiredCount,
      filter_pillar_category: null,
      filter_doc_type: null,
      filter_document_id: PINNED_DOC_ID,
    });

    if (!fallbackError && fallbackData && fallbackData.length > 0) {
      rawResults = fallbackData;
      logger.log(`[RAG] Fallback exitoso: ${rawResults.length} chunks del documento core`);
    } else {
      logger.error(`[RAG] Fallback falló, no hay contexto disponible`);
    }
  }

  // 3) Algoritmo de Priorización y Diversidad
  const pinnedChunks: any[] = [];
  const otherChunks: any[] = [];

  rawResults.forEach((row: any) => {
    if (row.document_id === PINNED_DOC_ID) {
      pinnedChunks.push(row);
    } else {
      otherChunks.push(row);
    }
  });

  // Asegurar que tenemos al menos unos cuantos del Core si existen
  // Tomamos hasta 3 del Core para empezar
  const selectedChunks: any[] = pinnedChunks.slice(0, 3);

  // Agrupamos el resto por document_id para diversidad
  const chunksByDoc: Record<string, any[]> = {};
  otherChunks.forEach((row: any) => {
    const docId = row.document_id || 'unknown';
    if (!chunksByDoc[docId]) {
      chunksByDoc[docId] = [];
    }
    chunksByDoc[docId].push(row);
  });

  const uniqueDocIds = Object.keys(chunksByDoc);
  logger.log(`[RAG] Documentos únicos encontrados (excluyendo Core): ${uniqueDocIds.length}`);

  // Estrategia Round Robin para el resto
  let maxChunksPerDoc = 0;
  uniqueDocIds.forEach(id => {
    maxChunksPerDoc = Math.max(maxChunksPerDoc, chunksByDoc[id].length);
  });

  // Rellenar hasta desiredCount
  for (let i = 0; i < maxChunksPerDoc; i++) {
    for (const docId of uniqueDocIds) {
      if (selectedChunks.length >= desiredCount) break;

      if (chunksByDoc[docId][i]) {
        selectedChunks.push(chunksByDoc[docId][i]);
      }
    }
    if (selectedChunks.length >= desiredCount) break;
  }

  // Reordenar el resultado final por similitud real para que los mejores (incluso si diversos) salgan primero?
  // O mantener la diversidad "arriba"?
  // Normalmente para el contexto del LLM, el orden importa menos que la presencia.
  // Pero si cortamos contexto, mejor que los más relevantes estén.
  // Vamos a reordenar por score de similitud descendente el set final.

  selectedChunks.sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0));

  logger.log(`[RAG] Seleccionados ${selectedChunks.length} chunks finales de ${uniqueDocIds.length} fuentes distintas.`);

  const chunks: KnowledgeChunk[] = selectedChunks.map((row: any) => ({
    content: row.content_chunk,
    metadata: row.metadata_json,
    similarity_score: typeof row.similarity === 'number' ? row.similarity : undefined,
  }));

  // Logging para verificar que RAG funciona
  if (chunks.length > 0) {
    logger.log(`✅ RAG search exitoso: ${chunks.length} chunks encontrados para query: "${query.substring(0, 50)}..."`);
    // Loguear fuentes
    const sources = Array.from(new Set(chunks.map(c => c.metadata?.document_title || c.metadata?.filename || 'unknown')));
    logger.log(`   Fuentes: ${sources.slice(0, 5).join(', ')}${sources.length > 5 ? '...' : ''}`);
  } else {
    logger.warn(`⚠️ RAG search sin resultados`);
  }

  return chunks;
}

