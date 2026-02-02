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
    logger.log(`[RAG] Generando embedding para: "${query.substring(0, 80)}..."`);

    // El SDK nuevo usa ai.models.embedContent directamente
    const resp = await (ai as any).models.embedContent({
      model: 'text-embedding-004',
      contents: [query], // Array de strings
    });

    // La respuesta tiene embeddings array, cada uno con values
    const embedding =
      resp?.embeddings?.[0]?.values;

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

  const rawResults = data || [];
  logger.log(`[RAG] RPC devolvió ${rawResults.length} resultados crudos`);

  // 3) Algoritmo de Diversidad
  // Agrupamos por document_id
  const chunksByDoc: Record<string, any[]> = {};
  rawResults.forEach((row: any) => {
    const docId = row.document_id || 'unknown';
    if (!chunksByDoc[docId]) {
      chunksByDoc[docId] = [];
    }
    chunksByDoc[docId].push(row);
  });

  const uniqueDocIds = Object.keys(chunksByDoc);
  logger.log(`[RAG] Documentos únicos encontrados: ${uniqueDocIds.length}`);

  // Seleccionamos chunks asegurando diversidad
  // Estrategia: Round Robin. Tomamos el mejor de cada documento, luego el segundo mejor, etc.
  const selectedChunks: any[] = [];
  const usedDocIds = new Set<string>();

  let maxChunksPerDoc = 0;
  uniqueDocIds.forEach(id => {
    maxChunksPerDoc = Math.max(maxChunksPerDoc, chunksByDoc[id].length);
  });

  for (let i = 0; i < maxChunksPerDoc; i++) {
    for (const docId of uniqueDocIds) {
      if (chunksByDoc[docId][i]) {
        // Solo añadimos si aún no llegamos al límite deseado
        if (selectedChunks.length < desiredCount) {
          selectedChunks.push(chunksByDoc[docId][i]);
        }
      }
    }
    if (selectedChunks.length >= desiredCount) break;
  }

  // Si después del round robin aún faltan (porque había pocos documentos), 
  // rellenamos con lo que quede de los mejores scores globales que no hayamos cogido ya.
  // (Aunque el round robin ya recorre todo, pero el orden es distinto. 
  //  El round robin prioriza diversidad. Si queremos priorizar score puro después de asegurar min diversidad...)

  // En este caso, el round robin simple ya nos da una buena mezcla ordenada "horizontalmente".
  // Pero OJO: el "round robin" puede meter un chunk de muy baja calidad de un documento raro 
  // antes que un chunk de muy alta calidad del documento top.
  // MEJORA: Round Robin ponderado o simplemente limitar MaxChunksPerDoc.

  // Vamos a usar una estrategia más simple y robusta para este caso de uso:
  // 1. Tomar top 1 de cada documento único (hasta llenar cupo).
  // 2. Si sobra cupo, rellenar con los siguientes mejores por score global (que no estén ya).

  const finalResults: any[] = [];
  const includedChunkIds = new Set();

  // Paso A: Top 1 de cada documento (diversidad forzada)
  for (const docId of uniqueDocIds) {
    if (finalResults.length >= desiredCount) break;
    const bestChunk = chunksByDoc[docId][0]; // El 0 es el mejor porque RPC devuelve ordenado por similitud? 
    // RPC devuelve orden global, así que necesitamos ordenar cada grupo por score (o confiar en que el global order se mantiene relativo).
    // El RPC ordena por similitud descendente global.
    // Al agrupar, mantengamos el orden de aparición (que es orden de score).

    if (bestChunk) {
      finalResults.push(bestChunk);
      includedChunkIds.add(bestChunk.chunk_id);
    }
  }

  // Paso B: Rellenar con los mejores restantes (por score global)
  if (finalResults.length < desiredCount) {
    for (const row of rawResults) {
      if (finalResults.length >= desiredCount) break;
      if (!includedChunkIds.has(row.chunk_id)) {
        finalResults.push(row);
        includedChunkIds.add(row.chunk_id);
      }
    }
  }

  // Reordenar el resultado final por similitud real para que los mejores (incluso si diversos) salgan primero?
  // O mantener la diversidad "arriba"?
  // Normalmente para el contexto del LLM, el orden importa menos que la presencia.
  // Pero si cortamos contexto, mejor que los más relevantes estén.
  // Vamos a reordenar por score de similitud descendente el set final.

  finalResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

  logger.log(`[RAG] Seleccionados ${finalResults.length} chunks finales de ${uniqueDocIds.length} fuentes distintas.`);

  const chunks: KnowledgeChunk[] = finalResults.map((row: any) => ({
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

