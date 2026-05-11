import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";

function tok() {
  return randomBytes(24).toString("hex");
}
function invite() {
  return randomBytes(5).toString("hex");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId =
    searchParams.get("userId") ?? (await actorUserIdFromRequest(req));
  const rows = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: "desc" },
  });
  return NextResponse.json(
    rows.map((r) => ({
      workspaceId: r.workspace.id,
      name: r.workspace.name,
      inviteCode: r.workspace.inviteCode,
      role: r.role,
    }))
  );
}

export async function POST(req: Request) {
  const creatorUserId = await actorUserIdFromRequest(req);
  const body = (await req.json()) as { name?: string };
  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : "Untitled Workspace";

  const ws = await prisma.workspace.create({
    data: {
      name,
      inviteCode: invite(),
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: ws.id,
      userId: creatorUserId,
      displayName: creatorUserId,
      role: "owner",
      contextToken: tok(),
      agentConfig: {
        agent_id: `${creatorUserId}-agent`,
        name: `${creatorUserId}'s Agent`,
        type: "custom",
        capabilities: [],
      },
    },
  });

  await broadcastWorkspaceEvent(ws.id, {
    type: "member_joined",
    payload: { user_id: creatorUserId, workspace_id: ws.id },
  });

  return NextResponse.json({
    workspaceId: ws.id,
    inviteCode: ws.inviteCode,
    onboardingRequired: true,
  });
}
