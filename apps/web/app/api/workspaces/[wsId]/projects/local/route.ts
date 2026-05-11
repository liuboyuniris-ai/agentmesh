import { NextResponse } from "next/server";
import { actorUserIdFromWorkspaceAuth } from "@/lib/auth";
import {
  ingestLocalTextFilesProject,
  LOCAL_MAX_FILES,
} from "@/lib/projects/ingestLocalTextFiles";

export async function POST(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;

  let actorUserId: string;
  try {
    actorUserId = await actorUserIdFromWorkspaceAuth(wsId, req);
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const body = (await req.json()) as {
    name?: string;
    files?: Record<string, string>;
    /** When set, replace this local project's files and re-index (IDE sync). */
    projectId?: string;
  };

  const files = body.files ?? {};
  const keys = Object.keys(files);
  if (!keys.length) {
    return NextResponse.json({ error: "files map required" }, { status: 400 });
  }
  if (keys.length > LOCAL_MAX_FILES) {
    return NextResponse.json({ error: "too many files" }, { status: 400 });
  }

  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : "local-project";

  const replaceProjectId =
    typeof body.projectId === "string" && body.projectId.trim().length > 0
      ? body.projectId.trim()
      : undefined;

  const result = await ingestLocalTextFilesProject({
    workspaceId: wsId,
    ownerUserId: actorUserId,
    name,
    files,
    requireTextExtension: false,
    replaceProjectId,
  });

  if (result.status !== 200 || !result.project) {
    return NextResponse.json(
      { error: result.error ?? "ingest failed" },
      { status: result.status }
    );
  }

  return NextResponse.json({ project: result.project });
}
