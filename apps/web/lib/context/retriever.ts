import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  cosineSimilarity,
  embedQueryVector,
  vectorLiteral,
} from "@/lib/context/embeddings";
import { pgVectorReady } from "@/lib/context/pgvector";

export type ContextHit = {
  project_id: string;
  path: string;
  score: number;
  excerpt: string;
};

/** Vector score + keyword overlap (light lexical boost; no full BM25 index). */
const KEYWORD_FUSION_WEIGHT = 0.18;

/** First diversification pass: keep up to this many distinct chunks per file path. */
const MAX_HITS_PER_PATH = 2;

/** Returned excerpt length cap (stored chunk may be longer). */
const EXCERPT_RESPONSE_CHARS = 2400;

function clipExcerpt(s: string): string {
  return s.length <= EXCERPT_RESPONSE_CHARS
    ? s
    : s.slice(0, EXCERPT_RESPONSE_CHARS);
}

type RawHit = {
  project_id: string;
  path: string;
  excerpt: string;
  score: number;
};

/** Extract lexical terms from query (ASCII path-like tokens + longer CJK phrases). */
export function extractQueryTermsForKeywordBoost(query: string): string[] {
  const terms = new Set<string>();
  const lower = query.toLowerCase();
  for (const m of lower.matchAll(/[a-z0-9][a-z0-9_/-]{1,}/g)) {
    const t = m[0].replace(/^[-/]+|[-/]+$/g, "");
    if (t.length >= 2) terms.add(t);
  }
  for (const m of query.matchAll(/[\u4e00-\u9fff]{3,}/g)) {
    terms.add(m[0]);
  }
  return [...terms];
}

/** 0–1: fraction of query terms that appear in path or excerpt (case-insensitive). */
export function keywordOverlapRatio(
  query: string,
  path: string,
  excerpt: string
): number {
  const terms = extractQueryTermsForKeywordBoost(query);
  if (!terms.length) return 0;
  const hay = `${path}\n${excerpt}`.toLowerCase();
  let hit = 0;
  for (const t of terms) {
    if (hay.includes(t.toLowerCase())) hit++;
  }
  return hit / terms.length;
}

function fuseKeywordVectorScore(
  vectorScore: number,
  query: string,
  path: string,
  excerpt: string
): number {
  const kw = keywordOverlapRatio(query, path, excerpt);
  return vectorScore + KEYWORD_FUSION_WEIGHT * kw;
}

function rankRawHitsWithKeywordFusion(
  rows: RawHit[],
  query: string
): RawHit[] {
  return rows.map((r) => ({
    ...r,
    score: fuseKeywordVectorScore(r.score, query, r.path, r.excerpt),
  }));
}

/** Prefer up to MAX_HITS_PER_PATH chunks per file, then back-fill until topK. */
function diversifyHitsByPath(rows: RawHit[], topK: number): ContextHit[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const out: RawHit[] = [];
  const pathCount = new Map<string, number>();

  for (const r of sorted) {
    const pk = `${r.project_id}\0${r.path}`;
    const n = pathCount.get(pk) ?? 0;
    if (n >= MAX_HITS_PER_PATH) continue;
    pathCount.set(pk, n + 1);
    out.push(r);
    if (out.length >= topK) {
      return out.map((x) => ({
        project_id: x.project_id,
        path: x.path,
        score: x.score,
        excerpt: clipExcerpt(x.excerpt),
      }));
    }
  }

  const rowKey = (r: RawHit) =>
    `${r.project_id}\0${r.path}\0${r.excerpt.slice(0, 120)}`;
  const used = new Set(out.map(rowKey));
  for (const r of sorted) {
    if (out.length >= topK) break;
    const k = rowKey(r);
    if (used.has(k)) continue;
    used.add(k);
    out.push(r);
  }

  return out.slice(0, topK).map((x) => ({
    project_id: x.project_id,
    path: x.path,
    score: x.score,
    excerpt: clipExcerpt(x.excerpt),
  }));
}

export async function queryWorkspaceContext(params: {
  workspaceId: string;
  query: string;
  topK: number;
  readerUserId: string;
  scopeProjectIds?: string[];
}): Promise<ContextHit[]> {
  void params.readerUserId;

  const projects = await prisma.project.findMany({
    where: {
      workspaceId: params.workspaceId,
      sharingEnabled: true,
      snippetsShared: true,
      indexingStatus: "ready",
      ...(params.scopeProjectIds?.length
        ? { id: { in: params.scopeProjectIds } }
        : {}),
    },
    select: {
      id: true,
      fileTreeShared: true,
    },
  });
  const allowed = new Map(projects.map((p) => [p.id, p.fileTreeShared]));

  const pg = await pgVectorReady(prisma);
  const qv = await embedQueryVector(params.query);

  if (pg) {
    try {
      const vecStr = vectorLiteral(qv);
      const scopeIds = params.scopeProjectIds?.filter(Boolean) ?? [];
      const scopeClause =
        scopeIds.length > 0
          ? `AND ec."projectId" IN (${scopeIds.map((_, i) => `$${4 + i}`).join(", ")})`
          : "";
      const sql = `
        SELECT ec."projectId" AS project_id,
               ec."sourcePath" AS path,
               ec.excerpt,
               (1 - (ec.embedding_vec <=> $1::vector))::double precision AS score
        FROM "EmbeddingChunk" ec
        INNER JOIN "Project" p ON p.id = ec."projectId"
        WHERE p."workspaceId" = $2
          AND p."sharingEnabled" = true
          AND p."snippetsShared" = true
          AND p."indexingStatus" = 'ready'
          AND ec.embedding_vec IS NOT NULL
          ${scopeClause}
        ORDER BY ec.embedding_vec <=> $1::vector
        LIMIT $3
      `;
      const fetchLimit = Math.min(Math.max(params.topK * 6, 20), 80);
      const args: unknown[] = [vecStr, params.workspaceId, fetchLimit];
      if (scopeIds.length) args.push(...scopeIds);

      const rows = await prisma.$queryRawUnsafe<
        {
          project_id: string;
          path: string;
          excerpt: string;
          score: number;
        }[]
      >(sql, ...args);

      const filtered: RawHit[] = rows
        .filter((r) => allowed.has(r.project_id))
        .map((r) => {
          const ft = allowed.get(r.project_id);
          return {
            project_id: r.project_id,
            path: ft ? r.path : "[path withheld]",
            score: Number(r.score),
            excerpt: r.excerpt,
          };
        });
      const ranked = rankRawHitsWithKeywordFusion(filtered, params.query);
      return diversifyHitsByPath(ranked, params.topK);
    } catch {
      /* fall through to JSON scan */
    }
  }

  const fallback: RawHit[] = [];
  for (const p of projects) {
    const chunks = await prisma.embeddingChunk.findMany({
      where: { projectId: p.id },
      take: 1200,
    });
    for (const c of chunks) {
      const ev = c.embedding as number[] | null;
      if (!ev?.length) continue;
      const score = cosineSimilarity(qv, ev);
      fallback.push({
        project_id: p.id,
        path: p.fileTreeShared ? c.sourcePath : "[path withheld]",
        score,
        excerpt: c.excerpt,
      });
    }
  }

  const ranked = rankRawHitsWithKeywordFusion(fallback, params.query);
  return diversifyHitsByPath(ranked, params.topK);
}

/** Rows per interactive transaction — long single-tx loops hit Prisma/Neon timeouts ("Transaction not found"). */
const EMBEDDING_INSERT_BATCH = 40;

const txOpts = {
  maxWait: 15_000,
  timeout: 180_000,
} as const;

/** Insert chunks with optional pgvector column for similarity search. */
export async function insertEmbeddingChunks(params: {
  projectId: string;
  rows: { sourcePath: string; chunkIndex: number; excerpt: string; vec: number[] }[];
}): Promise<void> {
  const { rows } = params;
  if (!rows.length) return;

  const pg = await pgVectorReady(prisma);

  for (let i = 0; i < rows.length; i += EMBEDDING_INSERT_BATCH) {
    const slice = rows.slice(i, i + EMBEDDING_INSERT_BATCH);
    await prisma.$transaction(
      async (tx) => {
        if (pg) {
          for (const r of slice) {
            const lit = vectorLiteral(r.vec);
            await tx.$executeRawUnsafe(
              `INSERT INTO "EmbeddingChunk" ("id","projectId","sourcePath","chunkIndex","excerpt","embedding","embedding_vec")
               VALUES ($1::text, $2::text, $3::text, $4::int, $5::text, $6::jsonb, $7::vector)`,
              randomUUID(),
              params.projectId,
              r.sourcePath,
              r.chunkIndex,
              r.excerpt,
              JSON.stringify(r.vec),
              lit
            );
          }
        } else {
          await tx.embeddingChunk.createMany({
            data: slice.map((r) => ({
              projectId: params.projectId,
              sourcePath: r.sourcePath,
              chunkIndex: r.chunkIndex,
              excerpt: r.excerpt,
              embedding: r.vec as object,
            })),
          });
        }
      },
      txOpts
    );
  }
}
