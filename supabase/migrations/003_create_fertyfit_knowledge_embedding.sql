-- Migration: Ensure fertyfit_knowledge has embedding column and vector indexes
-- Created: 2025
-- Description: Adds embedding vector column and relevant indexes to fertyfit_knowledge for RAG

-- Enable pgvector extension (idempotente)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column if it does not exist
ALTER TABLE fertyfit_knowledge
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create IVFFLAT index for fast similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_fertyfit_knowledge_embedding_ivfflat
ON fertyfit_knowledge
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Optional: index on pillar_category inside metadata_json for filtered searches
CREATE INDEX IF NOT EXISTS idx_fertyfit_knowledge_pillar_category
ON fertyfit_knowledge ((metadata_json->>'pillar_category'));

-- Optional: index on doc_type inside metadata_json
CREATE INDEX IF NOT EXISTS idx_fertyfit_knowledge_doc_type
ON fertyfit_knowledge ((metadata_json->>'doc_type'));


