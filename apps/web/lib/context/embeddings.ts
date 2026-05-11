/** Matches DB column vector(1536) / OpenAI text-embedding-3-small default. */
export const EMBEDDING_DIM = 1536;

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function geminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    undefined
  );
}

/** Which remote embedding stack is active (OpenAI wins if both are set). */
export type EmbeddingBackend = "openai" | "gemini" | "local_fallback";

export function embeddingBackendLabel(): EmbeddingBackend {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (geminiApiKey()) return "gemini";
  return "local_fallback";
}

/** IDs that always 404 on v1beta `batchEmbedContents` or are deprecated for embed. */
const GEMINI_EMBEDDING_MODEL_ALIASES: Record<string, string> = {
  "text-embedding-004": "gemini-embedding-001",
};

/**
 * Resolved model id for `v1beta/.../models/{id}:batchEmbedContents` (no `models/` prefix).
 * Exported for dev diagnostics (`/api/debug/embedding`).
 */
export function resolveGeminiEmbeddingModelId(): string {
  /**
   * Note: If `GEMINI_EMBEDDING_MODEL` is set in the **shell**, it wins over repo `.env`
   * (Next/dotenv does not override existing env). Old value `text-embedding-004` breaks
   * the API — we remap it here.
   */
  let raw =
    process.env.GEMINI_EMBEDDING_MODEL?.trim() ?? "gemini-embedding-001";
  raw = raw.replace(/^\uFEFF/, "").trim();
  raw = raw.replace(/^models\//, "");
  const lower = raw.toLowerCase();
  const mapped =
    GEMINI_EMBEDDING_MODEL_ALIASES[raw] ??
    GEMINI_EMBEDDING_MODEL_ALIASES[lower] ??
    (lower.includes("text-embedding-004") ? "gemini-embedding-001" : null);
  return mapped ?? raw;
}

function geminiOutputDimensionality(): number {
  const raw = process.env.GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY?.trim();
  if (!raw) return EMBEDDING_DIM;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : EMBEDDING_DIM;
}

type GeminiEmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/** Gemini `gemini-embedding-001` supports `outputDimensionality` (e.g. 1536 for pgvector); else pad/truncate in `normalizeEmbedding`. */
async function embedTextsGemini(
  texts: string[],
  taskType: GeminiEmbedTask
): Promise<number[][]> {
  const key = geminiApiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) missing");
  }

  const modelPath = resolveGeminiEmbeddingModelId();
  const modelResource = `models/${modelPath}`;
  const outputDim = geminiOutputDimensionality();
  const out: number[][] = [];
  const batchSize = 100;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(modelPath)}:batchEmbedContents`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: modelResource,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: outputDim,
        })),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini embeddings ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as {
      embeddings?: { values?: number[] }[];
    };
    const rows = json.embeddings ?? [];
    if (rows.length !== batch.length) {
      throw new Error(
        `Gemini batchEmbedContents: expected ${batch.length} embeddings, got ${rows.length}`
      );
    }
    for (const row of rows) {
      const values = row.values;
      if (!values?.length) {
        throw new Error("Gemini embedding missing values");
      }
      out.push(normalizeEmbedding(values));
    }
  }

  return out;
}

export function embedTextFallback(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIM).fill(0);
  const t = text.slice(0, 50_000);
  for (let i = 0; i < t.length; i++) {
    v[i % EMBEDDING_DIM] += t.charCodeAt(i) / 1000;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function getEmbeddingConfigDebug(): {
  backend: EmbeddingBackend;
  openaiKeySet: boolean;
  geminiKeySet: boolean;
  rawGeminiEmbeddingModelEnv: string | null;
  resolvedGeminiEmbeddingModelId: string;
} {
  return {
    backend: embeddingBackendLabel(),
    openaiKeySet: Boolean(process.env.OPENAI_API_KEY?.trim()),
    geminiKeySet: Boolean(geminiApiKey()),
    rawGeminiEmbeddingModelEnv:
      process.env.GEMINI_EMBEDDING_MODEL?.trim() || null,
    resolvedGeminiEmbeddingModelId: resolveGeminiEmbeddingModelId(),
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** Pad/truncate to DB vector dimension and L2-normalize. */
export function normalizeEmbedding(vec: number[]): number[] {
  let v =
    vec.length > EMBEDDING_DIM
      ? vec.slice(0, EMBEDDING_DIM)
      : vec.length < EMBEDDING_DIM
        ? [...vec, ...new Array(EMBEDDING_DIM - vec.length).fill(0)]
        : [...vec];
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/** Serialize for Postgres ::vector cast via parameterized text. */
export function vectorLiteral(vec: number[]): string {
  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(`embedding dim ${vec.length} !== ${EMBEDDING_DIM}`);
  }
  if (!vec.every((x) => Number.isFinite(x))) {
    throw new Error("embedding contains non-finite values");
  }
  return `[${vec.join(",")}]`;
}

/** Batch OpenAI embeddings (text-embedding-3-small, 1536-d). */
export async function embedTextsOpenAI(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENAI_API_KEY missing");
  }
  const model =
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

  const out: number[][] = [];
  const batchSize = 64;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: batch,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI embeddings ${res.status}: ${errText}`);
    }
    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    for (const row of sorted) {
      out.push(normalizeEmbedding(row.embedding));
    }
  }
  return out;
}

/**
 * Prefer OpenAI when configured, else Gemini (AI Studio key), else deterministic local vectors.
 */
export async function embedTextsForIndex(texts: string[]): Promise<number[][]> {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return embedTextsOpenAI(texts);
  }
  if (geminiApiKey()) {
    return embedTextsGemini(texts, "RETRIEVAL_DOCUMENT");
  }
  return texts.map((t) => embedTextFallback(t));
}

export async function embedQueryVector(query: string): Promise<number[]> {
  if (process.env.OPENAI_API_KEY?.trim()) {
    const rows = await embedTextsOpenAI([query]);
    return rows[0]!;
  }
  if (geminiApiKey()) {
    const rows = await embedTextsGemini([query], "RETRIEVAL_QUERY");
    return rows[0]!;
  }
  return embedTextFallback(query);
}
