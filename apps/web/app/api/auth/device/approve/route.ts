import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";
import {
  normalizeUserCode,
  USER_CODE_RE,
} from "@/lib/deviceAuth";

export async function POST(req: Request) {
  const userId = await actorUserIdFromRequest(req);
  const body = (await req.json()) as {
    userCode?: string;
    workspaceId?: string;
  };

  const userCodeRaw = body.userCode?.trim() ?? "";
  const workspaceId = body.workspaceId?.trim() ?? "";
  const userCode = normalizeUserCode(userCodeRaw);

  if (!userCode || !USER_CODE_RE.test(userCode)) {
    return NextResponse.json({ error: "invalid_user_code" }, { status: 400 });
  }
  if (!workspaceId) {
    return NextResponse.json({ error: "missing_workspace_id" }, { status: 400 });
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) {
    return NextResponse.json({ error: "not_workspace_member" }, { status: 403 });
  }

  const session = await prisma.deviceAuthSession.findUnique({
    where: { userCode },
  });
  if (!session || session.status !== "pending") {
    return NextResponse.json({ error: "unknown_or_used_code" }, { status: 404 });
  }
  if (session.expiresAt < new Date()) {
    await prisma.deviceAuthSession
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }

  await prisma.deviceAuthSession.update({
    where: { id: session.id },
    data: {
      userId,
      workspaceId,
      contextToken: member.contextToken,
      status: "complete",
    },
  });

  return NextResponse.json({ ok: true });
}
