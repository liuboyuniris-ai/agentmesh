-- pgvector extension (requires Postgres with vector available; use pgvector/pgvector image or install extension)
CREATE EXTENSION IF NOT EXISTS vector;

-- Cosine / inner-product search column (1536 dims matches OpenAI text-embedding-3-small default)
ALTER TABLE "EmbeddingChunk" ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1536);

-- Optional: IVFFLAT/HNSW indexes can be added after data load for large workspaces.
