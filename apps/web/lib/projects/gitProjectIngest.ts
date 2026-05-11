import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { cloneHostedGitRepo } from "@/lib/git/clone";
import { resolveGithubAccessToken } from "@/lib/oauth/resolveGithubToken";
import { runFullProjectIndex } from "@/lib/context/indexProject";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";
import { recordProjectIndexError } from "@/lib/workspace/activity";

/** Fire-and-forget: clone `Project.sourceUrl` into storage, then full index. */
export function scheduleGitProjectCloneAndIndex(projectId: string): void {
  void runGitProjectCloneAndIndex(projectId).catch((e) => {
    console.error("[gitProjectIngest]", projectId, e);
  });
}

async function resolveDefaultBranch(
  token: string,
  repoFullName: string
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return "main";
  const j = (await res.json()) as { default_branch?: string };
  const b = j.default_branch?.trim();
  return b && b.length > 0 ? b : "main";
}

export async function runGitProjectCloneAndIndex(
  projectId: string
): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.sourceType !== "git" || !project.sourceUrl?.trim()) {
    return;
  }

  const url = project.sourceUrl.trim();
  const m = url.match(/github\.com\/([^/]+\/[^/.]+)/i);
  const repoFullName = m?.[1] ?? "";

  const dest = path.join(process.cwd(), "storage", "repos", project.id);
  const userId = project.ownerUserId;

  await prisma.project.update({
    where: { id: projectId },
    data: { indexingStatus: "indexing", indexError: null },
  });

  const token = await resolveGithubAccessToken({ userId });
  if (!token) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        indexingStatus: "error",
        indexError: "GitHub not connected. Connect GitHub and retry.",
      },
    });
    await recordProjectIndexError(
      projectId,
      "GitHub not connected. Connect GitHub and retry."
    );
    return;
  }

  const branch =
    repoFullName.length > 0
      ? await resolveDefaultBranch(token, repoFullName)
      : "main";

  try {
    await fs.rm(dest, { recursive: true, force: true });
  } catch {
    /* empty */
  }

  try {
    await cloneHostedGitRepo({
      repoUrl: url,
      destDir: dest,
      branch,
      token,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.project.update({
      where: { id: projectId },
      data: { indexingStatus: "error", indexError: msg.slice(0, 2000) },
    });
    await recordProjectIndexError(projectId, msg.slice(0, 2000));
    return;
  }

  await broadcastWorkspaceEvent(project.workspaceId, {
    type: "project_connected",
    payload: {
      project_id: project.id,
      name: project.name,
      owner_user_id: userId,
    },
  });

  try {
    await runFullProjectIndex(projectId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.project.update({
      where: { id: projectId },
      data: { indexingStatus: "error", indexError: msg.slice(0, 2000) },
    });
    await recordProjectIndexError(projectId, msg.slice(0, 2000));
  }
}
