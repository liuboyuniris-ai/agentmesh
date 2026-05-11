import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";
import {
  embedTextsForIndex,
  embeddingBackendLabel,
} from "@/lib/context/embeddings";
import { chunkSourceForIndex } from "@/lib/context/chunkDocument";
import { insertEmbeddingChunks } from "@/lib/context/retriever";
import { recordProjectIndexReady } from "@/lib/workspace/activity";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "vendor",
  "__pycache__",
  ".cache",
]);

const TEXT_EXT = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "md",
  "mdx",
  "yaml",
  "yml",
  "css",
  "html",
  "htm",
  "prisma",
  "rs",
  "go",
  "py",
  "java",
  "kt",
  "swift",
  "vue",
]);

async function walkFiles(dir: string, repoRoot: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    const rel = path.relative(repoRoot, p).replace(/\\/g, "/");
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      out.push(...(await walkFiles(p, repoRoot)));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).slice(1).toLowerCase();
      if (!TEXT_EXT.has(ext)) continue;
      out.push(rel);
    }
  }
  return out;
}

async function buildFileTree(repoRoot: string): Promise<unknown> {
  type Node = {
    name: string;
    path: string;
    type: "file" | "dir";
    children?: Node[];
  };
  async function build(relDir: string): Promise<Node[]> {
    const abs = path.join(repoRoot, relDir);
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return [];
    }
    const nodes: Node[] = [];
    for (const ent of entries) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      const rel = path.join(relDir, ent.name).replace(/\\/g, "/");
      if (ent.isDirectory()) {
        const children = await build(rel);
        nodes.push({
          name: ent.name,
          path: rel,
          type: "dir",
          children,
        });
      } else {
        nodes.push({ name: ent.name, path: rel, type: "file" });
      }
    }
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return nodes;
  }
  return {
    name: "/",
    path: "",
    type: "dir" as const,
    children: await build("."),
  };
}

export async function runFullProjectIndex(projectId: string): Promise<void> {
  const repoRoot = path.join(process.cwd(), "storage", "repos", projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: { indexingStatus: "indexing", indexError: null },
  });

  await prisma.embeddingChunk.deleteMany({ where: { projectId } });

  const files = await walkFiles(repoRoot, repoRoot);
  files.sort();

  let readmeSnippet = "";
  try {
    const readme =
      files.find((f) => /^readme\.md$/i.test(path.basename(f))) ??
      files.find((f) => f.toLowerCase().includes("readme"));
    if (readme) {
      const raw = await fs.readFile(path.join(repoRoot, readme), "utf8");
      readmeSnippet = raw.slice(0, 600);
    }
  } catch {
    /* ignore */
  }

  const modules = files
    .filter((f) => f.startsWith("src/") || f.startsWith("lib/"))
    .slice(0, 120)
    .map((f) => ({
      name: path.basename(f),
      path_hint: f,
    }));

  const toEmbed: {
    sourcePath: string;
    chunkIndex: number;
    excerpt: string;
    text: string;
  }[] = [];

  let ifaceHints: { kind: string; name: string; detail?: string }[] = [];

  const MAX_FILES = 120;
  const MAX_CHARS = 12_000;
  let countedFiles = 0;

  for (const rel of files) {
    if (countedFiles >= MAX_FILES) break;
    const abs = path.join(repoRoot, rel);
    let raw = "";
    try {
      raw = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    if (raw.length > MAX_CHARS) raw = raw.slice(0, MAX_CHARS);

    const apiMatches = Array.from(
      raw.matchAll(/(?:fetch|axios)\([^)]*['"`]\/api\/[^'"`]+['"`]/g)
    )
      .slice(0, 5)
      .map((m) => ({
        kind: "http_call",
        name: m[0].slice(0, 120),
      }));
    ifaceHints = ifaceHints.concat(apiMatches);

    const chunks = chunkSourceForIndex(rel, raw);
    for (const row of chunks) {
      toEmbed.push({
        sourcePath: rel,
        chunkIndex: row.chunkIndex,
        excerpt: row.excerpt,
        text: row.text,
      });
    }
    countedFiles++;
  }

  if (toEmbed.length) {
    const vectors = await embedTextsForIndex(toEmbed.map((r) => r.text));
    await insertEmbeddingChunks({
      projectId,
      rows: toEmbed.map((r, i) => ({
        sourcePath: r.sourcePath,
        chunkIndex: r.chunkIndex,
        excerpt: r.excerpt,
        vec: vectors[i]!,
      })),
    });
  }

  const batchLen = toEmbed.length;

  const fileTree = await buildFileTree(repoRoot);

  const summary =
    readmeSnippet.length > 80
      ? `Repo summary (auto): ${readmeSnippet.slice(0, 280)}…`
      : `Indexed ${batchLen} chunks from ${countedFiles} source files.`;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      fileTree: fileTree as object,
      modules: modules as object,
      exposedInterfaces: ifaceHints.slice(0, 50) as object,
      summary,
      indexingStatus: "ready",
      lastSyncedAt: new Date(),
      vectorNamespace: projectId,
    },
  });

  await recordProjectIndexReady(projectId);

  const proj = await prisma.project.findUnique({ where: { id: projectId } });
  if (proj) {
    await broadcastWorkspaceEvent(proj.workspaceId, {
      type: "project_synced",
      payload: {
        project_id: proj.id,
        name: proj.name,
        summary: proj.summary,
        modules_count: modules.length,
        embedding_backend: embeddingBackendLabel(),
      },
    });
  }
}
