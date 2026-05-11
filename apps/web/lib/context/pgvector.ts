import type { PrismaClient } from "@prisma/client";

let cached: boolean | null = null;

/** True when Postgres has pgvector and EmbeddingChunk.embedding_vec exists. */
export async function pgVectorReady(prisma: PrismaClient): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const ext = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS exists
    `;
    const col = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EmbeddingChunk'
          AND column_name = 'embedding_vec'
      ) AS exists
    `;
    cached = Boolean(ext[0]?.exists && col[0]?.exists);
  } catch {
    cached = false;
  }
  return cached;
}

export function resetPgVectorCache(): void {
  cached = null;
}
