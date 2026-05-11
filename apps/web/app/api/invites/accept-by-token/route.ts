import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";
import { createWorkspaceMemberIfNeeded } from "@/lib/workspaces/createWorkspaceMember";
import { hashInviteToken } from "@/lib/inviteToken";
import { inviteMatchesViewer } from "@/lib/invites/inviteMatchesViewer";

export async function POST(req: Request) {
  const userId = await actorUserIdFromRequest(req);
  const body = (await req.json()) as { token?: string };
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const hash = hashInviteToken(token);
  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      acceptTokenHash: hash,
      status: "pending",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (!invite) {
    return NextResponse.json(
      { error: "invalid_or_expired_invite" },
      { status: 404 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!inviteMatchesViewer(invite, userId, user?.email)) {
    return NextResponse.json({ error: "wrong_account" }, { status: 403 });
  }

  await createWorkspaceMemberIfNeeded({
    workspaceId: invite.workspaceId,
    userId,
  });

  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: {
      status: "accepted",
      inviteeUserId: userId,
      inviteeEmail: user?.email?.trim().toLowerCase() ?? invite.inviteeEmail,
    },
  });

  return NextResponse.json({ ok: true, workspaceId: invite.workspaceId });
}
