import path from "node:path";

/** Target chunk size (characters) for embedding text. */
const CHUNK_CHARS = 880;
/** Overlap between consecutive chunks to avoid cutting mid-definition. */
const OVERLAP_CHARS = 150;
/** Max stored per row in DB / embedding input (safety cap). */
const CHUNK_HARD_MAX = 10_000;

function slidingChunks(text: string, size: number, overlap: number): string[] {
  const t = text.trim();
  if (!t) return [];
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    const piece = t.slice(i, i + size);
    out.push(piece);
    if (i + size >= t.length) break;
    i += Math.max(1, size - overlap);
  }
  return out.length ? out : [""];
}

/** Split Markdown on heading boundaries so API doc sections stay together when possible. */
export function splitMarkdownSections(md: string): string[] {
  const t = md.trim();
  if (!t) return [];
  const parts = t.split(/(?=\n#{1,6}\s+)/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

export type IndexChunkRow = {
  chunkIndex: number;
  excerpt: string;
  text: string;
};

/**
 * Build indexable chunks for one source file: Markdown-aware sections + sliding overlap.
 */
export function chunkSourceForIndex(
  sourcePath: string,
  raw: string
): IndexChunkRow[] {
  const ext = path.extname(sourcePath).slice(1).toLowerCase();
  const isMd = ext === "md" || ext === "mdx";
  const segments = isMd ? splitMarkdownSections(raw) : [raw.trim()];

  const pieces: string[] = [];
  for (const seg of segments) {
    if (!seg) continue;
    pieces.push(...slidingChunks(seg, CHUNK_CHARS, OVERLAP_CHARS));
  }
  if (!pieces.length) {
    return [{ chunkIndex: 0, excerpt: "", text: "" }];
  }

  return pieces.map((text, chunkIndex) => {
    const capped =
      text.length > CHUNK_HARD_MAX ? text.slice(0, CHUNK_HARD_MAX) : text;
    return {
      chunkIndex,
      excerpt: capped,
      text: capped,
    };
  });
}
