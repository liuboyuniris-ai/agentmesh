import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromWorkspaceAuth } from "@/lib/auth";
import { runFullProjectIndex } from "@/lib/context/indexProject";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";
import { recordProjectIndexError } from "@/lib/workspace/activity";

const MAX_FILES = 160;
const MAX_FILE_BYTES = 96_000;

const IGNORE_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
]);

export async function POST(
  req: Request,
  ctx: { params: { wsId: string; projectId: string } }
) {
  const { wsId, projectId } = ctx.params;

  let actorUserId: string;
  try {
    actorUserId = await actorUserIdFromWorkspaceAuth(wsId, req);
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: wsId, ownerUserId: actorUserId },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as { files?: Record<string, string> };
  const files = body.files ?? {};
  const keys = Object.keys(files);
  if (!keys.length) {
    return NextResponse.json({ error: "files map required" }, { status: 400 });
  }
  if (keys.length > MAX_FILES) {
    return NextResponse.json({ error: "too many files" }, { status: 400 });
  }

  const dest = path.join(process.cwd(), "storage", "repos", project.id);
  await fs.mkdir(dest, { recursive: true });

  await prisma.project.update({
    where: { id: project.id },
    data: { indexingStatus: "indexing", indexError: null },
  });

  try {
    for (const rel of keys) {
      const normalized = rel.replace(/\\/g, "/").replace(/^\/+/, "");
      if (
        normalized.includes("..") ||
        normalized.startsWith(".git/") ||
        normalized.split("/").some((p) => IGNORE_SEGMENTS.has(p))
      ) {
        continue;
      }
      let content = files[rel] ?? "";
      if (typeof content !== "string") content = String(content);
      if (content.length > MAX_FILE_BYTES) {
        content = content.slice(0, MAX_FILE_BYTES);
      }
      const target = path.join(dest, normalized);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf8");
    }

    await runFullProjectIndex(project.id);

    await broadcastWorkspaceEvent(wsId, {
      type: "project_synced",
      payload: {
        project_id: project.id,
        name: project.name,
        incremental: true,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.project.update({
      where: { id: project.id },
      data: { indexingStatus: "error", indexError: msg.slice(0, 2000) },
    });
    await recordProjectIndexError(project.id, msg.slice(0, 2000));
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const updated = await prisma.project.findUnique({ where: { id: project.id } });
  return NextResponse.json({ project: updated });
}
