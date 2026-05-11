import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  actorUserIdFromRequest,
  requireWorkspaceMember,
} from "@/lib/auth";
import { getPublicAppOrigin } from "@/lib/http/publicOrigin";
import {
  generateInvitePlainToken,
  hashInviteToken,
} from "@/lib/inviteToken";
import { sendWorkspaceInviteEmail } from "@/lib/email/sendWorkspaceInvite";

const HANDLE_RE = /^[a-z][a-z0-9_-]{2,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

export async function POST(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;
  const actorId = await actorUserIdFromRequest(req);
  try {
    await requireWorkspaceMember(wsId, actorId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { email: true },
  });
  const actorEmail = actor?.email?.trim().toLowerCase() ?? "";

  const body = (await req.json()) as {
    inviteeHandle?: string;
    invitee?: string;
  };
  const rawInput =
    (typeof body.invitee === "string" ? body.invitee : null) ??
    (typeof body.inviteeHandle === "string" ? body.inviteeHandle : null) ??
    "";
  const raw = rawInput.trim();

  let inviteeUserId: string | null = null;
  let inviteeEmail: string | null = null;

  if (EMAIL_RE.test(raw)) {
    const email = raw.toLowerCase();
    inviteeEmail = email;
    if (actorEmail && email === actorEmail) {
      return NextResponse.json(
        { error: "cannot invite yourself" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      inviteeUserId = user.id;
    }
  } else {
    const h = raw.toLowerCase();
    if (!h || !HANDLE_RE.test(h)) {
      return NextResponse.json(
        { error: "invalid invitee (use handle or email)" },
        { status: 400 }
      );
    }
    inviteeUserId = h;
    if (h === actorId) {
      return NextResponse.json(
        { error: "cannot invite yourself" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findUnique({ where: { id: h } });
    if (!user) {
      return NextResponse.json(
        { error: "no user with this AgentMesh 账号" },
        { status: 404 }
      );
    }
    inviteeEmail = user.email?.trim().toLowerCase() ?? null;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: wsId },
  });
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  const inviter = await prisma.user.findUnique({
    where: { id: actorId },
  });
  const inviterLabel = inviter?.displayName?.trim() || actorId;

  if (inviteeUserId) {
    const already = await prisma.workspaceMember.findFirst({
      where: { workspaceId: wsId, userId: inviteeUserId },
    });
    if (already) {
      return NextResponse.json({ error: "already a member" }, { status: 409 });
    }
  }

  let pending = await prisma.workspaceInvite.findFirst({
    where:
      inviteeUserId != null
        ? {
            workspaceId: wsId,
            inviteeUserId,
            status: "pending",
          }
        : {
            workspaceId: wsId,
            status: "pending",
            inviteeUserId: null,
            inviteeEmail: inviteeEmail ?? "",
          },
  });

  const origin = getPublicAppOrigin(req);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  let plainToken: string | null = null;

  if (pending?.acceptTokenHash) {
    return NextResponse.json({
      invite: pending,
      message:
        "A pending invite already exists; link was emailed when it was created (if email is configured).",
    });
  }

  if (pending && !pending.acceptTokenHash) {
    plainToken = generateInvitePlainToken();
    pending = await prisma.workspaceInvite.update({
      where: { id: pending.id },
      data: {
        acceptTokenHash: hashInviteToken(plainToken),
        expiresAt,
      },
    });
  } else if (!pending) {
    plainToken = generateInvitePlainToken();
    pending = await prisma.workspaceInvite.create({
      data: {
        workspaceId: wsId,
        inviterUserId: actorId,
        inviteeUserId,
        inviteeEmail,
        acceptTokenHash: hashInviteToken(plainToken),
        expiresAt,
      },
    });
  }

  if (!plainToken) {
    return NextResponse.json({ error: "invite_state_error" }, { status: 500 });
  }

  const acceptUrl = `${origin}/invite/accept?token=${encodeURIComponent(plainToken)}`;

  const emailResult = inviteeEmail?.trim()
    ? await sendWorkspaceInviteEmail({
        toEmail: inviteeEmail.trim(),
        acceptUrl,
        workspaceName: workspace.name,
        inviterLabel,
      })
    : { sent: false as const, skippedReason: "no_invitee_email" as const };

  const payload: Record<string, unknown> = { invite: pending, email: emailResult };
  if (!emailResult.sent) {
    payload.acceptUrl = acceptUrl;
  }

  return NextResponse.json(payload);
}
