import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberFromBearer } from "@/lib/auth";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";

export async function POST(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;

  let member;
  try {
    member = await memberFromBearer(wsId, req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  const prev =
    member.agentConfig && typeof member.agentConfig === "object"
      ? (member.agentConfig as Record<string, unknown>)
      : {};

  await prisma.workspaceMember.update({
    where: { id: member.id },
    data: {
      agentConfig: {
        ...prev,
        liveAgentStatus: body,
        liveAgentStatusAt: new Date().toISOString(),
      } as object,
    },
  });

  await broadcastWorkspaceEvent(wsId, {
    type: "member_agent_status",
    payload: {
      user_id: member.userId,
      ...body,
    },
  });

  return NextResponse.json({ ok: true });
}
