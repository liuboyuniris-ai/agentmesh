import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest, requireWorkspaceMember } from "@/lib/auth";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";
import { resetPgVectorCache } from "@/lib/context/pgvector";

export async function PATCH(
  req: Request,
  ctx: { params: { wsId: string; projectId: string } }
) {
  const { wsId, projectId } = ctx.params;
  const userId = await actorUserIdFromRequest(req);

  try {
    await requireWorkspaceMember(wsId, userId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const me = await prisma.workspaceMember.findFirst({
    where: { workspaceId: wsId, userId },
  });
  if (!me) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    sharingEnabled?: boolean;
    fileTreeShared?: boolean;
    snippetsShared?: boolean;
  };

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: wsId },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canManage =
    me.role === "owner" || project.ownerUserId === userId;
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      ...(typeof body.sharingEnabled === "boolean"
        ? { sharingEnabled: body.sharingEnabled }
        : {}),
      ...(typeof body.fileTreeShared === "boolean"
        ? { fileTreeShared: body.fileTreeShared }
        : {}),
      ...(typeof body.snippetsShared === "boolean"
        ? { snippetsShared: body.snippetsShared }
        : {}),
    },
  });

  if (updated.sharingEnabled === false) {
    await prisma.embeddingChunk.deleteMany({ where: { projectId: updated.id } });
    resetPgVectorCache();
  }

  await broadcastWorkspaceEvent(wsId, {
    type: "state_update",
    payload: {
      kind: "project_sharing",
      project_id: updated.id,
      sharingEnabled: updated.sharingEnabled,
      fileTreeShared: updated.fileTreeShared,
      snippetsShared: updated.snippetsShared,
    },
  });

  return NextResponse.json({ project: updated });
}
