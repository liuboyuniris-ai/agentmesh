import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  actorUserIdFromRequest,
  memberFromBearer,
  requireWorkspaceMember,
} from "@/lib/auth";
import {
  ACTIVITY_KIND_INDEX_ERROR,
  ACTIVITY_KIND_INDEX_READY,
} from "@/lib/workspace/activity";

export async function GET(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;
  let userId: string;
  try {
    const m = await memberFromBearer(wsId, req);
    userId = m.userId;
  } catch {
    userId = await actorUserIdFromRequest(req);
    try {
      await requireWorkspaceMember(wsId, userId);
    } catch (e) {
      const status = (e as Error & { status?: number }).status ?? 403;
      return NextResponse.json({ error: "Forbidden" }, { status });
    }
  }

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const limit = Math.min(
    50,
    Math.max(1, rawLimit ? Number.parseInt(rawLimit, 10) || 30 : 30)
  );

  const rows = await prisma.workspaceActivity.findMany({
    where: { workspaceId: wsId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const memberIds = [...Array.from(new Set(rows.map((r) => r.actorUserId)))];
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: wsId, userId: { in: memberIds } },
    select: { userId: true, displayName: true },
  });
  const labelByUser = Object.fromEntries(
    members.map((m) => [m.userId, m.displayName?.trim() || m.userId])
  );

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      actorUserId: r.actorUserId,
      actorLabel: labelByUser[r.actorUserId] ?? r.actorUserId,
      projectId: r.projectId,
      projectName: r.projectName,
      sourceType: r.sourceType,
      kind: r.kind,
      kindLabel:
        r.kind === ACTIVITY_KIND_INDEX_READY
          ? "Index updated (searchable)"
          : r.kind === ACTIVITY_KIND_INDEX_ERROR
            ? "Index failed"
            : r.kind,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
