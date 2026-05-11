-- Approximate nearest neighbor for cosine distance (matches ORDER BY embedding_vec <=> $query).
-- Partial index: only rows with a stored vector (safe if any legacy rows lack embedding_vec).
CREATE INDEX IF NOT EXISTS "EmbeddingChunk_embedding_vec_hnsw_idx"
ON "EmbeddingChunk"
USING hnsw ("embedding_vec" vector_cosine_ops)
WHERE "embedding_vec" IS NOT NULL;
