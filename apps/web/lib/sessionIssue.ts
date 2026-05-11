import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
} from "@/lib/sessionConstants";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC };

export function hashSessionToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function parseCookieHeader(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    try {
      return decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

export async function createBrowserSession(
  userId: string
): Promise<{ rawToken: string }> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000);
  await prisma.session.create({
    data: { tokenHash, userId, expiresAt },
  });
  return { rawToken };
}

export function appendSessionCookie(res: NextResponse, rawToken: string): void {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function destroySessionFromRequest(req: Request): Promise<void> {
  const raw = parseCookieHeader(req.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (!raw) return;
  const tokenHash = hashSessionToken(raw);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export function clearSessionCookie(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 0,
  });
}
