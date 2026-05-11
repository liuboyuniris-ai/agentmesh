import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashDeviceCode } from "@/lib/deviceAuth";

export async function POST(req: Request) {
  const body = (await req.json()) as { device_code?: string };
  const deviceCode = body.device_code?.trim();
  if (!deviceCode) {
    return NextResponse.json({ error: "missing_device_code" }, { status: 400 });
  }

  const hash = hashDeviceCode(deviceCode);
  const row = await prisma.deviceAuthSession.findUnique({
    where: { deviceCodeHash: hash },
  });

  if (!row) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  if (row.expiresAt < new Date()) {
    await prisma.deviceAuthSession.delete({ where: { id: row.id } }).catch(() => undefined);
    return NextResponse.json({ error: "expired_token" }, { status: 400 });
  }

  if (row.status === "pending") {
    return NextResponse.json({ error: "authorization_pending" }, { status: 400 });
  }

  if (
    row.status === "complete" &&
    row.contextToken?.trim() &&
    row.workspaceId?.trim()
  ) {
    await prisma.deviceAuthSession.delete({ where: { id: row.id } });
    return NextResponse.json({
      access_token: row.contextToken,
      token_type: "Bearer",
      workspace_id: row.workspaceId,
    });
  }

  return NextResponse.json({ error: "denied" }, { status: 400 });
}
