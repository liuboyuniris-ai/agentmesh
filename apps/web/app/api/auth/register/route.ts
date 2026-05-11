import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  appendSessionCookie,
  createBrowserSession,
} from "@/lib/sessionIssue";

const HANDLE_RE = /^[a-z][a-z0-9_-]{2,31}$/;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    handle?: string;
    password?: string;
    email?: string;
    displayName?: string;
  };
  const handle = body.handle?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!handle || !HANDLE_RE.test(handle)) {
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "password too short" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { id: handle } });
  if (exists) {
    return NextResponse.json({ error: "user exists" }, { status: 409 });
  }

  const emailNorm = body.email?.trim()
    ? body.email.trim().toLowerCase()
    : null;
  if (emailNorm) {
    const dup = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (dup) {
      return NextResponse.json({ error: "email taken" }, { status: 409 });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      id: handle,
      email: emailNorm,
      displayName: body.displayName?.trim() || null,
      passwordHash,
    },
  });

  const { rawToken } = await createBrowserSession(handle);
  const res = NextResponse.json({
    ok: true,
    user: { id: handle, email: emailNorm },
  });
  appendSessionCookie(res, rawToken);
  return res;
}
