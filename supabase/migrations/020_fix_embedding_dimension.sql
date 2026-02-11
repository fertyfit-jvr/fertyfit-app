-- Migration: Fix everything for 3072 dimensions (Gemini Embedding 001)
-- Description: Updates table and RPC function to match the 3072-dimension model.

-- 1. Drop existing index (ivfflat has 2000 dim limit)
DROP INDEX IF EXISTS idx_fertyfit_knowledge_embedding_ivfflat;

-- 2. Clear current embeddings and update column to 3072
UPDATE fertyfit_knowledge SET embedding = NULL;

ALTER TABLE fertyfit_knowledge 
ALTER COLUMN embedding TYPE vector(3072);

-- 3. Update the RPC function to accept 3072 dimensions
CREATE OR REPLACE FUNCTION match_fertyfit_knowledge(
  query_embedding vector(3072),
  match_count int default 5,
  filter_pillar_category text default null,
  filter_doc_type text default null,
  filter_document_id text default null
)
returns table (
  content_chunk text,
  metadata_json jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    fk.content_chunk,
    fk.metadata_json,
    -- Usamos producto escalar negativo para aprovechar el index (si existiera)
    -- O simplemente distancia coseno 1 - (vec1 <=> vec2)
    1 - (fk.embedding <=> query_embedding) as similarity
  from fertyfit_knowledge fk
  where (filter_pillar_category is null or fk.metadata_json->>'pillar_category' = filter_pillar_category)
    and (filter_doc_type is null or fk.metadata_json->>'doc_type' = filter_doc_type)
    and (filter_document_id is null or fk.document_id = filter_document_id)
  order by fk.embedding <=> query_embedding
  limit match_count;
end;
$$;
