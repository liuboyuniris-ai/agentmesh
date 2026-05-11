import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  actorUserIdFromRequest,
  memberFromBearer,
  requireWorkspaceMember,
} from "@/lib/auth";

export async function GET(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;
  let userId: string;
  try {
    const m = await memberFromBearer(wsId, req);
    userId = m.userId;
  } catch {
    userId = await actorUserIdFromRequest(req);
    try {
      await requireWorkspaceMember(wsId, userId);
    } catch (e) {
      const status = (e as Error & { status?: number }).status ?? 403;
      return NextResponse.json({ error: "Forbidden" }, { status });
    }
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: wsId },
    include: {
      members: true,
      projects: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = workspace.members.find((m) => m.userId === userId);

  return NextResponse.json({
    ...workspace,
    viewerUserId: userId,
    myContextToken: me?.contextToken ?? null,
    members: workspace.members.map(
      ({ contextToken: _omit, ...rest }) => rest
    ),
  });
}
