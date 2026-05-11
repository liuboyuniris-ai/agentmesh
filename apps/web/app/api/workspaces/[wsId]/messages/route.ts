import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  actorUserIdFromRequest,
  memberFromBearer,
  requireWorkspaceMember,
} from "@/lib/auth";
import { broadcastWorkspaceEvent } from "@/lib/realtime/broadcast";

export async function POST(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;

  let actorUserId: string;
  try {
    const m = await memberFromBearer(wsId, req);
    actorUserId = m.userId;
  } catch {
    try {
      const userId = await actorUserIdFromRequest(req);
      await requireWorkspaceMember(wsId, userId);
      actorUserId = userId;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const msg = (await req.json()) as {
    type?: string;
    from?: string;
    to?: string;
    content?: Record<string, unknown>;
    requires_response?: boolean;
    task_id?: string;
  };

  if (!msg.type) {
    return NextResponse.json({ error: "type required" }, { status: 400 });
  }

  const row = await prisma.collaborationMessage.create({
    data: {
      workspaceId: wsId,
      taskId: msg.task_id ?? null,
      messageId: randomUUID(),
      type: msg.type,
      fromAgent: msg.from ?? `${actorUserId}-agent`,
      toTarget: msg.to ?? "workspace",
      content: (msg.content ?? {}) as object,
    },
  });

  await broadcastWorkspaceEvent(wsId, {
    type: "agent_message",
    payload: row,
  });

  if (msg.type === "dependency_discovered") {
    const c = msg.content ?? {};
    const fromP = String(c.from_project ?? "");
    const toP = String(c.to_project ?? "");
    if (fromP && toP) {
      await prisma.contextEdge.create({
        data: {
          workspaceId: wsId,
          fromProjectId: fromP,
          toProjectId: toP,
          relationType: String(c.relation_type ?? "depends_on"),
          confidence: Number(c.confidence ?? 0.5),
          discoveredBy: String(msg.from ?? actorUserId),
          evidence: c.evidence ? (c.evidence as object) : undefined,
        },
      });
    }
  }

  if (msg.type === "contract_violation") {
    await broadcastWorkspaceEvent(wsId, {
      type: "orchestrator_contract_alert",
      payload: {
        message_id: row.id,
        task_id: row.taskId,
        from_agent: row.fromAgent,
        content: row.content,
      },
    });
  }

  return NextResponse.json({ ok: true, id: row.id });
}
