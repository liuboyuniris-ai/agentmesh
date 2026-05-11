import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";
import { fetchOidcDiscovery } from "@/lib/oidc/discovery";
import { openOAuthToken, sealOAuthToken } from "@/lib/crypto/oauthToken";

export async function POST(req: Request) {
  const userId = await actorUserIdFromRequest(req);

  const row = await prisma.oAuthConnection.findUnique({
    where: { userId_provider: { userId, provider: "oidc" } },
  });

  if (!row?.refreshToken?.trim()) {
    return NextResponse.json(
      { error: "no_refresh_token", note: "Request offline_access / consent at IdP if supported." },
      { status: 400 }
    );
  }

  const meta = row.metadata as { issuer?: string } | null | undefined;
  const issuer = meta?.issuer?.trim();
  if (!issuer) {
    return NextResponse.json({ error: "missing_issuer_metadata" }, { status: 500 });
  }

  const clientId =
    process.env.OIDC_CLIENT_ID?.trim() ?? process.env.SSO_CLIENT_ID?.trim();
  const clientSecret =
    process.env.OIDC_CLIENT_SECRET?.trim() ??
    process.env.SSO_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "oidc_not_configured" }, { status: 500 });
  }

  let refreshPlain: string;
  try {
    refreshPlain = openOAuthToken(row.refreshToken);
  } catch {
    return NextResponse.json({ error: "cannot_decrypt_refresh_token" }, { status: 500 });
  }

  let doc;
  try {
    doc = await fetchOidcDiscovery(issuer);
  } catch {
    return NextResponse.json({ error: "discovery_failed" }, { status: 502 });
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshPlain,
    client_id: clientId,
    client_secret: clientSecret,
  });

  let tokens: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  try {
    const tr = await fetch(doc.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!tr.ok) {
      return NextResponse.json({ error: "token_refresh_failed" }, { status: 502 });
    }
    tokens = (await tr.json()) as typeof tokens;
  } catch {
    return NextResponse.json({ error: "token_refresh_failed" }, { status: 502 });
  }

  const access = tokens.access_token ?? "";
  const nextRefresh = tokens.refresh_token ?? refreshPlain;
  const expiresIn =
    typeof tokens.expires_in === "number" && Number.isFinite(tokens.expires_in)
      ? tokens.expires_in
      : null;
  const expiresAt =
    expiresIn != null ? new Date(Date.now() + expiresIn * 1000) : null;

  await prisma.oAuthConnection.update({
    where: { id: row.id },
    data: {
      accessToken: sealOAuthToken(access),
      refreshToken: sealOAuthToken(nextRefresh),
      expiresAt,
      scope: tokens.scope ?? row.scope,
      metadata: { issuer: doc.issuer },
    },
  });

  return NextResponse.json({ ok: true, expires_at: expiresAt?.toISOString() ?? null });
}
