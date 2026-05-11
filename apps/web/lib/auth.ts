import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import {
  hashSessionToken,
  parseCookieHeader,
  SESSION_COOKIE_NAME,
} from "@/lib/sessionIssue";

export function userIdFromRequest(req: Request): string {
  return (
    req.headers.get("x-user-id") ??
    process.env.DEV_USER_ID ??
    "alice"
  );
}

/** Cookie session wins; then `X-User-Id` / env fallbacks (dev-friendly). */
export async function actorUserIdFromRequest(req: Request): Promise<string> {
  const raw = parseCookieHeader(req.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (raw) {
    const tokenHash = hashSessionToken(raw);
    const row = await prisma.session.findUnique({
      where: { tokenHash },
      select: { expiresAt: true, userId: true },
    });
    if (row && row.expiresAt > new Date()) return row.userId;
  }
  return userIdFromRequest(req);
}

export async function requireWorkspaceMember(
  workspaceId: string,
  userId: string
) {
  const m = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!m) {
    const e = new Error("Forbidden");
    (e as Error & { status: number }).status = 403;
    throw e;
  }
  return m;
}

function bearerRaw(req: Request | NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim();
}

/** SHA-256 hex digest of a scoped sync token (server-side storage). */
export function hashScopedToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Random single-use-friendly token string (shown once to the user). */
export function newScopedSyncTokenPlaintext(): string {
  return `amsync_${randomBytes(24).toString("base64url")}`;
}

export async function memberFromBearer(
  workspaceId: string,
  req: Request | NextRequest
) {
  const token = bearerRaw(req);
  if (!token) {
    const e = new Error("Unauthorized");
    (e as Error & { status: number }).status = 401;
    throw e;
  }
  const m = await prisma.workspaceMember.findFirst({
    where: { workspaceId, contextToken: token },
  });
  if (!m) {
    const e = new Error("Forbidden");
    (e as Error & { status: number }).status = 403;
    throw e;
  }
  return m;
}

/**
 * Resolves the acting user for workspace-scoped Bearer or browser session.
 * Bearer: member `contextToken`, or short-lived **scoped sync token** (push-only storage).
 * Fallback: session / dev cookie + workspace membership.
 */
export async function actorUserIdFromWorkspaceAuth(
  workspaceId: string,
  req: Request | NextRequest
): Promise<string> {
  const token = bearerRaw(req);
  if (token) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, contextToken: token },
      select: { userId: true },
    });
    if (member) return member.userId;

    const scoped = await prisma.scopedSyncToken.findFirst({
      where: {
        workspaceId,
        tokenHash: hashScopedToken(token),
        expiresAt: { gt: new Date() },
      },
      select: { userId: true },
    });
    if (scoped) return scoped.userId;

    const e = new Error("Forbidden");
    (e as Error & { status: number }).status = 403;
    throw e;
  }

  const userId = await actorUserIdFromRequest(req);
  await requireWorkspaceMember(workspaceId, userId);
  return userId;
}
