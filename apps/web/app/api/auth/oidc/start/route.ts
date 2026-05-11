import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { fetchOidcDiscovery } from "@/lib/oidc/discovery";
import { newPkcePair } from "@/lib/oidc/pkce";

export const dynamic = "force-dynamic";

export async function GET() {
  const issuerRaw =
    process.env.SSO_ISSUER?.trim() ?? process.env.OIDC_ISSUER?.trim();
  const clientId =
    process.env.OIDC_CLIENT_ID?.trim() ?? process.env.SSO_CLIENT_ID?.trim();

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const redirectErr = (code: string) =>
    NextResponse.redirect(`${appBase}/dashboard?oidc_error=${encodeURIComponent(code)}`, 302);

  if (!issuerRaw || !clientId) {
    return redirectErr("config");
  }

  const redirectUri =
    process.env.OIDC_REDIRECT_URI?.trim() ??
    `${appBase}/api/auth/oidc/callback`;

  let doc;
  try {
    doc = await fetchOidcDiscovery(issuerRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "discovery_failed";
    return redirectErr(msg);
  }

  const { verifier, challenge } = newPkcePair();
  const state = randomUUID();

  const authorize = new URL(doc.authorization_endpoint);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set(
    "scope",
    process.env.OIDC_SCOPE ?? "openid email profile"
  );
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const accessType = process.env.OIDC_ACCESS_TYPE?.trim();
  if (accessType) {
    authorize.searchParams.set("access_type", accessType);
  }
  const prompt = process.env.OIDC_PROMPT?.trim();
  if (prompt) {
    authorize.searchParams.set("prompt", prompt);
  }

  const res = NextResponse.redirect(authorize.toString(), 302);
  const secure = process.env.NODE_ENV === "production";
  const maxAge = 600;
  res.cookies.set("oidc_pkce_verifier", verifier, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge,
  });
  res.cookies.set("oidc_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge,
  });
  res.cookies.set("oidc_issuer", doc.issuer, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge,
  });

  return res;
}
