import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashInviteToken } from "@/lib/inviteToken";

/**
 * Public: given a secret invite token, return routing hints for /invite/accept.
 * Does not mutate state.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();
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
    select: { inviteeEmail: true, inviteeUserId: true },
  });

  if (!invite) {
    return NextResponse.json({ error: "invalid_or_expired_invite" }, { status: 404 });
  }

  let inviteeEmail =
    invite.inviteeEmail?.trim().toLowerCase() ?? null;

  if (!inviteeEmail && invite.inviteeUserId) {
    const u = await prisma.user.findUnique({
      where: { id: invite.inviteeUserId },
      select: { email: true },
    });
    inviteeEmail = u?.email?.trim().toLowerCase() ?? null;
  }

  const accountExists = inviteeEmail
    ? (await prisma.user.findUnique({
        where: { email: inviteeEmail },
        select: { id: true },
      })) != null
    : invite.inviteeUserId != null;

  return NextResponse.json({
    inviteeEmail,
    accountExists,
  });
}
