import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest, requireWorkspaceMember } from "@/lib/auth";
import { resolveGithubAccessToken } from "@/lib/oauth/resolveGithubToken";
import { scheduleGitProjectCloneAndIndex } from "@/lib/projects/gitProjectIngest";

const REPO_FULL_NAME = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

async function verifyGithubRepo(
  token: string,
  repoFullName: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) {
    return {
      ok: false,
      status: 404,
      message: "Repository not found or no access",
    };
  }
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false,
      status: 502,
      message: t.slice(0, 300),
    };
  }
  return { ok: true };
}

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

  const body = (await req.json()) as { repoFullName?: string };
  const repoFullName = body.repoFullName?.trim() ?? "";
  if (!REPO_FULL_NAME.test(repoFullName)) {
    return NextResponse.json(
      { error: "repoFullName must be like owner/repo" },
      { status: 400 }
    );
  }

  const token = await resolveGithubAccessToken({ userId });
  if (!token) {
    return NextResponse.json(
      { error: "GitHub not connected", code: "github_not_connected" },
      { status: 400 }
    );
  }

  const access = await verifyGithubRepo(token, repoFullName);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status }
    );
  }

  const slug = repoFullName.includes("/")
    ? repoFullName.split("/")[1]!
    : repoFullName;
  const cloneUrl = `https://github.com/${repoFullName}.git`;

  const project = await prisma.project.create({
    data: {
      workspaceId: wsId,
      ownerUserId: userId,
      name: slug,
      sourceType: "git",
      sourceUrl: cloneUrl,
      indexingStatus: "pending",
    },
  });

  scheduleGitProjectCloneAndIndex(project.id);

  return NextResponse.json({
    projectId: project.id,
    indexingStatus: project.indexingStatus,
  });
}
