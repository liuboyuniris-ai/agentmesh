import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";

function contextTok() {
  return randomBytes(24).toString("hex");
}

export async function createWorkspaceMemberIfNeeded(params: {
  workspaceId: string;
  userId: string;
  displayName?: string | null;
}) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { workspaceId: params.workspaceId, userId: params.userId },
  });
  if (existing) {
    return { member: existing, created: false as const };
  }

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      displayName: params.displayName ?? params.userId,
      role: "member",
      contextToken: contextTok(),
      agentConfig: {
        agent_id: `${params.userId}-agent`,
        name: `${params.userId}'s Agent`,
        type: "custom",
        capabilities: [],
      },
    },
  });

  await broadcastWorkspaceEvent(params.workspaceId, {
    type: "member_joined",
    payload: { user_id: params.userId, workspace_id: params.workspaceId },
  });

  return { member, created: true as const };
}
