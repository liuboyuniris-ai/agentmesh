import { NextResponse } from "next/server";
import {
  actorUserIdFromRequest,
  memberFromBearer,
  requireWorkspaceMember,
} from "@/lib/auth";
import { queryWorkspaceContext } from "@/lib/context/retriever";

export async function POST(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;

  let readerUserId: string;
  try {
    const m = await memberFromBearer(wsId, req);
    readerUserId = m.userId;
  } catch {
    try {
      const userId = await actorUserIdFromRequest(req);
      await requireWorkspaceMember(wsId, userId);
      readerUserId = userId;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = (await req.json()) as {
    query?: string;
    top_k?: number;
    scope?: string;
    project_ids?: string[];
    task_id?: string | null;
  };

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const scopeProjectIds =
    Array.isArray(body.project_ids) && body.project_ids.length > 0
      ? body.project_ids
      : body.scope &&
          body.scope !== "workspace" &&
          body.scope !== "all_projects" &&
          body.scope !== "all"
        ? [body.scope]
        : undefined;

  const hits = await queryWorkspaceContext({
    workspaceId: wsId,
    query: body.query.trim(),
    topK: Math.min(body.top_k ?? 5, 20),
    readerUserId,
    scopeProjectIds,
  });

  const summary = {
    query: body.query,
    hits,
  };

  return NextResponse.json(summary);
}
