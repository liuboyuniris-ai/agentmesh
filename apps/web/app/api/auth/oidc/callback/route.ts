import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import type { JWTPayload } from "jose";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sealOAuthToken } from "@/lib/crypto/oauthToken";
import { fetchOidcDiscovery } from "@/lib/oidc/discovery";
import { decodeJwtPayload } from "@/lib/oidc/jwtPayload";
import { verifyOidcIdToken } from "@/lib/oidc/verifyIdToken";
import {
  appendSessionCookie,
  createBrowserSession,
} from "@/lib/sessionIssue";

function slugFromEmail(email: string): string {
  const local = email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const base = local.slice(0, 28);
  return base.length >= 3 ? base : `user_${randomBytes(4).toString("hex")}`;
}

type TokenResponse = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const redirectDashboard = (search: string) =>
    NextResponse.redirect(`${appBase}/dashboard${search}`, 302);

  const jar = cookies();
  const expectedState = jar.get("oidc_state")?.value;
  const verifier = jar.get("oidc_pkce_verifier")?.value;
  const issuerStored = jar.get("oidc_issuer")?.value;

  const clientId =
    process.env.OIDC_CLIENT_ID?.trim() ?? process.env.SSO_CLIENT_ID?.trim();
  const clientSecret =
    process.env.OIDC_CLIENT_SECRET?.trim() ??
    process.env.SSO_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.OIDC_REDIRECT_URI?.trim() ??
    `${appBase}/api/auth/oidc/callback`;

  const secure = process.env.NODE_ENV === "production";

  const clearOidcCookies = (res: NextResponse) => {
    for (const name of ["oidc_state", "oidc_pkce_verifier", "oidc_issuer"]) {
      res.cookies.set(name, "", {
        httpOnly: true,
        path: "/",
        secure,
        maxAge: 0,
      });
    }
  };

  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifier ||
    !issuerStored ||
    !clientId ||
    !clientSecret
  ) {
    const res = redirectDashboard("?oidc_error=state");
    clearOidcCookies(res);
    return res;
  }

  let doc;
  try {
    doc = await fetchOidcDiscovery(issuerStored);
  } catch {
    const res = redirectDashboard("?oidc_error=discovery");
    clearOidcCookies(res);
    return res;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: verifier,
  });

  let tokens: TokenResponse;
  try {
    const tr = await fetch(doc.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!tr.ok) {
      const res = redirectDashboard("?oidc_error=token");
      clearOidcCookies(res);
      return res;
    }
    tokens = (await tr.json()) as TokenResponse;
  } catch {
    const res = redirectDashboard("?oidc_error=token");
    clearOidcCookies(res);
    return res;
  }

  const idToken = tokens.id_token;
  if (!idToken) {
    const res = redirectDashboard("?oidc_error=no_id_token");
    clearOidcCookies(res);
    return res;
  }

  const skipVerify =
    process.env.OIDC_SKIP_JWT_VERIFY?.trim() === "true" ||
    process.env.OIDC_SKIP_JWT_VERIFY?.trim() === "1";

  let payload: JWTPayload | Record<string, unknown>;

  if (skipVerify) {
    const decoded = decodeJwtPayload(idToken);
    if (!decoded) {
      const res = redirectDashboard("?oidc_error=claims");
      clearOidcCookies(res);
      return res;
    }
    payload = decoded;
  } else {
    try {
      const audience =
        process.env.OIDC_AUDIENCE?.trim() ||
        process.env.OIDC_RESOURCE?.trim() ||
        undefined;
      payload = await verifyOidcIdToken({
        idToken,
        discovery: doc,
        clientId,
        audience,
      });
    } catch {
      const res = redirectDashboard("?oidc_error=jwt_verify");
      clearOidcCookies(res);
      return res;
    }
  }

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) {
    const res = redirectDashboard("?oidc_error=claims");
    clearOidcCookies(res);
    return res;
  }

  const issuer = doc.issuer;
  const email = typeof payload.email === "string" ? payload.email : null;
  const displayName =
    typeof payload.name === "string"
      ? payload.name
      : typeof payload.preferred_username === "string"
        ? payload.preferred_username
        : null;

  const existingIdentity = await prisma.oidcIdentity.findUnique({
    where: { issuer_subject: { issuer, subject: sub } },
    include: { user: true },
  });

  let userId: string;

  if (existingIdentity) {
    userId = existingIdentity.userId;
    if (email && !existingIdentity.user.email) {
      await prisma.user.update({
        where: { id: userId },
        data: { email },
      });
    }
  } else {
    let candidate =
      email != null
        ? slugFromEmail(email)
        : `oidc_${createHash("sha256")
            .update(`${issuer}:${sub}`)
            .digest("hex")
            .slice(0, 20)}`;

    const emailOwner =
      email != null
        ? await prisma.user.findUnique({ where: { email } })
        : null;

    if (emailOwner) {
      userId = emailOwner.id;
      await prisma.oidcIdentity.create({
        data: {
          userId,
          issuer,
          subject: sub,
          email,
        },
      });
    } else {
      let suffix = 0;
      while (true) {
        const tryId = suffix === 0 ? candidate : `${candidate}_${suffix}`;
        const clash = await prisma.user.findUnique({ where: { id: tryId } });
        if (!clash) {
          candidate = tryId;
          break;
        }
        suffix++;
        if (suffix > 50) {
          candidate = `oidc_${randomBytes(8).toString("hex")}`;
          break;
        }
      }
      userId = candidate;
      await prisma.user.create({
        data: {
          id: userId,
          email,
          displayName,
          passwordHash: null,
        },
      });
      await prisma.oidcIdentity.create({
        data: {
          userId,
          issuer,
          subject: sub,
          email,
        },
      });
    }
  }

  const access = tokens.access_token ?? "";
  const refresh = tokens.refresh_token ?? null;
  const expiresIn =
    typeof tokens.expires_in === "number" && Number.isFinite(tokens.expires_in)
      ? tokens.expires_in
      : null;
  const expiresAt =
    expiresIn != null ? new Date(Date.now() + expiresIn * 1000) : null;

  await prisma.oAuthConnection.upsert({
    where: { userId_provider: { userId, provider: "oidc" } },
    create: {
      userId,
      provider: "oidc",
      accessToken: sealOAuthToken(access),
      refreshToken: refresh ? sealOAuthToken(refresh) : null,
      scope: tokens.scope ?? null,
      expiresAt,
      metadata: { issuer },
    },
    update: {
      accessToken: sealOAuthToken(access),
      refreshToken: refresh ? sealOAuthToken(refresh) : undefined,
      scope: tokens.scope ?? undefined,
      expiresAt: expiresAt ?? undefined,
      metadata: { issuer },
    },
  });

  const { rawToken } = await createBrowserSession(userId);
  const res = redirectDashboard("?oidc=connected");
  appendSessionCookie(res, rawToken);
  clearOidcCookies(res);
  return res;
}
