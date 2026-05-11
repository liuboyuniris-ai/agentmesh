import AdmZip from "adm-zip";
import { NextResponse } from "next/server";
import { actorUserIdFromRequest, requireWorkspaceMember } from "@/lib/auth";
import {
  ingestLocalTextFilesProject,
  LOCAL_MAX_FILE_BYTES,
} from "@/lib/projects/ingestLocalTextFiles";

export const runtime = "nodejs";

const MAX_ZIP_BYTES = 8 * 1024 * 1024;
const MAX_ZIP_FILES = 200;

export async function POST(
  req: Request,
  ctx: { params: { wsId: string } }
) {
  const { wsId } = ctx.params;
  const userId = await actorUserIdFromRequest(req);

  try {
    await requireWorkspaceMember(wsId, userId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("zip");
  const nameRaw = form.get("name");
  const name =
    typeof nameRaw === "string" && nameRaw.trim().length > 0
      ? nameRaw.trim()
      : "zip-project";

  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: 'Expected multipart field "zip" (File)' },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: "ZIP too large (max 8MB for this endpoint)" },
      { status: 400 }
    );
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch {
    return NextResponse.json({ error: "Invalid ZIP archive" }, { status: 400 });
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const files: Record<string, string> = {};

  for (const e of entries) {
    const rawName = e.entryName.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!rawName || rawName.endsWith("/")) continue;

    let data: Buffer;
    try {
      data = e.getData();
    } catch {
      continue;
    }

    if (data.length > LOCAL_MAX_FILE_BYTES) continue;

    let text: string;
    try {
      text = data.toString("utf8");
    } catch {
      continue;
    }

    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text.slice(0, 4096))) continue;

    files[rawName] = text;
    if (Object.keys(files).length >= MAX_ZIP_FILES) break;
  }

  const result = await ingestLocalTextFilesProject({
    workspaceId: wsId,
    ownerUserId: userId,
    name,
    files,
    maxFiles: MAX_ZIP_FILES,
    requireTextExtension: true,
  });

  if (result.status !== 200 || !result.project) {
    return NextResponse.json(
      { error: result.error ?? "ingest failed" },
      { status: result.status }
    );
  }

  return NextResponse.json({ project: result.project });
}
