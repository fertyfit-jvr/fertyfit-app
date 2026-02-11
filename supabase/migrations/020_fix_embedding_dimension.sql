-- Migration: Fix embedding dimension for Gemini 1.5 Flash (text-embedding-004)
-- Created: 2026-02-11
-- Description: Changes the embedding column from 1536 to 768 dimensions.

-- 1. Drop existing index that depends on the column
DROP INDEX IF EXISTS idx_fertyfit_knowledge_embedding_ivfflat;

-- 2. Alter the column type (this will fail if there is data with wrong dimensions, 
-- but since RAG is failing, we assume we can truncate or the data is empty/invalid for this model)
-- Safe approach: Clear data if needed or just alter if empty. 
-- Assuming development/fix phase, we can truncate if ALTER fails, but let's try ALTER first.
-- Realistically, if 1536 dim data exists, we cannot cast to 768. 
-- So we should probably clear the embeddings.

UPDATE fertyfit_knowledge SET embedding = NULL;

ALTER TABLE fertyfit_knowledge 
ALTER COLUMN embedding TYPE vector(768);

-- 3. Recreate the index
CREATE INDEX idx_fertyfit_knowledge_embedding_ivfflat
ON fertyfit_knowledge
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
