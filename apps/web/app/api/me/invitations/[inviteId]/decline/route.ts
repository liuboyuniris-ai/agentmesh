import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";
import { inviteMatchesViewer } from "@/lib/invites/inviteMatchesViewer";

export async function POST(
  req: Request,
  ctx: { params: { inviteId: string } }
) {
  const { inviteId } = ctx.params;
  const userId = await actorUserIdFromRequest(req);

  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "invite not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!inviteMatchesViewer(invite, userId, user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.workspaceInvite.update({
    where: { id: inviteId },
    data: { status: "declined" },
  });

  return NextResponse.json({ ok: true });
}
