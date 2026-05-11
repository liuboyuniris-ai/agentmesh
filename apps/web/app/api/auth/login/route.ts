import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  appendSessionCookie,
  createBrowserSession,
} from "@/lib/sessionIssue";

export async function POST(req: Request) {
  const body = (await req.json()) as { handle?: string; password?: string };
  const handle = body.handle?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!handle) {
    return NextResponse.json({ error: "missing handle" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: handle } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const { rawToken } = await createBrowserSession(user.id);
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  });
  appendSessionCookie(res, rawToken);
  return res;
}
