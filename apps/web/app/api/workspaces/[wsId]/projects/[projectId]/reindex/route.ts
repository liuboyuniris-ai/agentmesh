import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest, requireWorkspaceMember } from "@/lib/auth";
import { scheduleGitProjectCloneAndIndex } from "@/lib/projects/gitProjectIngest";

export async function POST(
  _req: Request,
  ctx: { params: { wsId: string; projectId: string } }
) {
  const { wsId, projectId } = ctx.params;
  const userId = await actorUserIdFromRequest(_req);

  try {
    await requireWorkspaceMember(wsId, userId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: wsId, ownerUserId: userId },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (project.sourceType !== "git" || !project.sourceUrl?.trim()) {
    return NextResponse.json(
      { error: "Only git projects with sourceUrl can be reindexed" },
      { status: 400 }
    );
  }

  scheduleGitProjectCloneAndIndex(project.id);

  return NextResponse.json({
    projectId: project.id,
    indexingStatus: "pending",
  });
}
