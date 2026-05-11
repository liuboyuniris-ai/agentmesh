import path from "node:path";
import fs from "node:fs/promises";
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runFullProjectIndex } from "@/lib/context/indexProject";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";
import { recordProjectIndexError } from "@/lib/workspace/activity";

export const LOCAL_MAX_FILES = 120;
export const LOCAL_MAX_FILE_BYTES = 96_000;

export const IGNORE_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
]);

export const TEXT_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
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
  "toml",
  "txt",
]);

export function sanitizeRelativePath(rel: string): string | null {
  const normalized = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) return null;
  if (normalized.startsWith(".git/")) return null;
  if (normalized.split("/").some((p) => IGNORE_SEGMENTS.has(p))) return null;
  return normalized;
}

export function isLikelyTextSourcePath(rel: string): boolean {
  const base = rel.split("/").pop() ?? "";
  const ext = base.includes(".")
    ? base.split(".").pop()!.toLowerCase()
    : "";
  return TEXT_EXTENSIONS.has(ext);
}

/** Path security + optional text extension filter (for zip uploads). */
export function normalizeUploadRelPath(rel: string): string | null {
  const s = sanitizeRelativePath(rel);
  if (!s) return null;
  if (!isLikelyTextSourcePath(s)) return null;
  return s;
}

async function writeFilteredFilesToDest(
  dest: string,
  filteredKeys: string[],
  filtered: Record<string, string>
) {
  for (const rel of filteredKeys) {
    let content = filtered[rel] ?? "";
    if (typeof content !== "string") content = String(content);
    if (content.length > LOCAL_MAX_FILE_BYTES) {
      content = content.slice(0, LOCAL_MAX_FILE_BYTES);
    }
    const target = path.join(dest, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }
}

/**
 * Create a `local` Project, write text files under storage/repos/{id}, index.
 * When `replaceProjectId` is set, reuses that project (same owner, sourceType local).
 */
export async function ingestLocalTextFilesProject(params: {
  workspaceId: string;
  ownerUserId: string;
  name: string;
  files: Record<string, string>;
  maxFiles?: number;
  /** When true, only paths with known text extensions are kept (zip uploads). */
  requireTextExtension?: boolean;
  /** Re-upload into an existing local project (IDE re-sync). */
  replaceProjectId?: string | null;
}): Promise<{ project: Project | null; error?: string; status: number }> {
  const maxFiles = params.maxFiles ?? LOCAL_MAX_FILES;
  const requireTextExtension = params.requireTextExtension ?? false;

  const keys = Object.keys(params.files);
  if (!keys.length) {
    return { project: null, error: "no acceptable files", status: 400 };
  }

  const filtered: Record<string, string> = {};
  for (const rel of keys) {
    const normalized = sanitizeRelativePath(rel);
    if (!normalized) continue;
    if (requireTextExtension && !isLikelyTextSourcePath(normalized)) continue;
    filtered[normalized] = params.files[rel] ?? "";
  }

  const filteredKeys = Object.keys(filtered);
  if (!filteredKeys.length) {
    return { project: null, error: "no acceptable files", status: 400 };
  }
  if (filteredKeys.length > maxFiles) {
    return { project: null, error: "too many files", status: 400 };
  }

  const replaceId = params.replaceProjectId?.trim() || null;

  if (replaceId) {
    const existing = await prisma.project.findFirst({
      where: {
        id: replaceId,
        workspaceId: params.workspaceId,
        ownerUserId: params.ownerUserId,
        sourceType: "local",
      },
    });
    if (!existing) {
      return {
        project: null,
        error: "project not found, not local, or not owned by you",
        status: 404,
      };
    }

    const dest = path.join(process.cwd(), "storage", "repos", existing.id);
    try {
      await prisma.embeddingChunk.deleteMany({
        where: { projectId: existing.id },
      });
      await fs.rm(dest, { recursive: true, force: true });
      await fs.mkdir(dest, { recursive: true });

      const displayName =
        params.name.trim().length > 0 ? params.name.trim() : existing.name;
      await prisma.project.update({
        where: { id: existing.id },
        data: {
          name: displayName,
          indexingStatus: "indexing",
          indexError: null,
        },
      });

      await writeFilteredFilesToDest(dest, filteredKeys, filtered);

      await broadcastWorkspaceEvent(params.workspaceId, {
        type: "project_connected",
        payload: {
          project_id: existing.id,
          name: displayName,
          owner_user_id: params.ownerUserId,
          source_type: "local",
        },
      });

      await runFullProjectIndex(existing.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.project.update({
        where: { id: existing.id },
        data: { indexingStatus: "error", indexError: msg.slice(0, 2000) },
      });
      await recordProjectIndexError(existing.id, msg.slice(0, 2000));
      return { project: null, error: msg, status: 500 };
    }

    const updated = await prisma.project.findUnique({
      where: { id: existing.id },
    });
    return { project: updated, status: 200 };
  }

  const project = await prisma.project.create({
    data: {
      workspaceId: params.workspaceId,
      ownerUserId: params.ownerUserId,
      name: params.name.trim().length > 0 ? params.name.trim() : "local-project",
      sourceType: "local",
      indexingStatus: "pending",
    },
  });

  const dest = path.join(process.cwd(), "storage", "repos", project.id);
  await fs.mkdir(dest, { recursive: true });

  try {
    await writeFilteredFilesToDest(dest, filteredKeys, filtered);

    await prisma.project.update({
      where: { id: project.id },
      data: { indexingStatus: "indexing", indexError: null },
    });

    await broadcastWorkspaceEvent(params.workspaceId, {
      type: "project_connected",
      payload: {
        project_id: project.id,
        name: project.name,
        owner_user_id: params.ownerUserId,
        source_type: "local",
      },
    });

    await runFullProjectIndex(project.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.project.update({
      where: { id: project.id },
      data: { indexingStatus: "error", indexError: msg.slice(0, 2000) },
    });
    await recordProjectIndexError(project.id, msg.slice(0, 2000));
    return { project: null, error: msg, status: 500 };
  }

  const updated = await prisma.project.findUnique({ where: { id: project.id } });
  return { project: updated, status: 200 };
}
