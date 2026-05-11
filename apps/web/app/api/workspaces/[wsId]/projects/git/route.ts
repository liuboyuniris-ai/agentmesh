import { NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest, requireWorkspaceMember } from "@/lib/auth";
import { cloneHostedGitRepo } from "@/lib/git/clone";
import { resolveGithubAccessToken } from "@/lib/oauth/resolveGithubToken";
import { runFullProjectIndex } from "@/lib/context/indexProject";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";
import { recordProjectIndexError } from "@/lib/workspace/activity";

export async function POST(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;
  const userId = await actorUserIdFromRequest(req);

  try {
    await requireWorkspaceMember(wsId, userId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    repoUrl?: string;
    name?: string;
    branch?: string;
    githubToken?: string;
    gitToken?: string;
  };

  if (!body.repoUrl?.trim()) {
    return NextResponse.json({ error: "repoUrl required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      workspaceId: wsId,
      ownerUserId: userId,
      name:
        typeof body.name === "string" && body.name.trim().length > 0
          ? body.name.trim()
          : body.repoUrl.split("/").pop() ?? "git-repo",
      sourceType: "git",
      sourceUrl: body.repoUrl.trim(),
      indexingStatus: "pending",
    },
  });

  const dest = path.join(process.cwd(), "storage", "repos", project.id);

  const gitToken = await resolveGithubAccessToken({
    userId,
    explicit: body.gitToken ?? body.githubToken,
  });

  try {
    await cloneHostedGitRepo({
      repoUrl: body.repoUrl.trim(),
      destDir: dest,
      branch: body.branch,
      token: gitToken,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.project.update({
      where: { id: project.id },
      data: { indexingStatus: "error", indexError: msg.slice(0, 2000) },
    });
    await recordProjectIndexError(project.id, msg.slice(0, 2000));
    return NextResponse.json({ error: msg, projectId: project.id }, { status: 422 });
  }

  await broadcastWorkspaceEvent(wsId, {
    type: "project_connected",
    payload: {
      project_id: project.id,
      name: project.name,
      owner_user_id: userId,
    },
  });

  try {
    await runFullProjectIndex(project.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.project.update({
      where: { id: project.id },
      data: { indexingStatus: "error", indexError: msg.slice(0, 2000) },
    });
    await recordProjectIndexError(project.id, msg.slice(0, 2000));
    return NextResponse.json({ error: msg, projectId: project.id }, { status: 500 });
  }

  const updated = await prisma.project.findUnique({ where: { id: project.id } });

  return NextResponse.json({ project: updated });
}
