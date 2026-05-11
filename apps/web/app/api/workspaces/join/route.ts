import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";
import { createWorkspaceMemberIfNeeded } from "@/lib/workspaces/createWorkspaceMember";

export async function POST(req: Request) {
  const userId = await actorUserIdFromRequest(req);
  return handleJoinCodes(userId, req);
}

async function handleJoinCodes(
  userId: string,
  req: Request
): Promise<NextResponse> {
  const body = (await req.json()) as {
    inviteCode?: string;
    displayName?: string;
  };
  const code = body.inviteCode?.trim();
  if (!code) {
    return NextResponse.json({ error: "inviteCode required" }, { status: 400 });
  }

  const ws = await prisma.workspace.findUnique({
    where: { inviteCode: code },
  });
  if (!ws) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  const existing = await prisma.workspaceMember.findFirst({
    where: { workspaceId: ws.id, userId },
  });
  if (existing) {
    return NextResponse.json({
      workspaceId: ws.id,
      alreadyMember: true,
      contextToken: existing.contextToken,
    });
  }

  const { member } = await createWorkspaceMemberIfNeeded({
    workspaceId: ws.id,
    userId,
    displayName: body.displayName,
  });

  return NextResponse.json({
    workspaceId: ws.id,
    contextToken: member.contextToken,
  });
}
