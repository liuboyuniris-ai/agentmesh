import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest, requireWorkspaceMember } from "@/lib/auth";

export async function GET(
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
    where: { id: projectId, workspaceId: wsId },
    select: {
      indexingStatus: true,
      lastSyncedAt: true,
      indexError: true,
      name: true,
      sourceType: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}
