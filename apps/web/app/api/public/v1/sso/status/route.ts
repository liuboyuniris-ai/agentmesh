import { NextResponse } from "next/server";
import { allowPublicRequest } from "@/lib/rateLimit";

/**
 * Enterprise SSO / OIDC status (authorize flow lives under `/api/auth/oidc/*`).
 */
export async function GET(req: Request) {
  if (!allowPublicRequest(req)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const expected = process.env.AGENTMESH_PUBLIC_API_KEY?.trim();
  if (expected) {
    const key = req.headers.get("x-agentmesh-api-key")?.trim();
    if (key !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const issuer =
    process.env.SSO_ISSUER?.trim() ?? process.env.OIDC_ISSUER?.trim();
  const clientId =
    process.env.OIDC_CLIENT_ID?.trim() ?? process.env.SSO_CLIENT_ID?.trim();

  const wired = Boolean(issuer && clientId);

  return NextResponse.json({
    enabled: wired,
    issuer: issuer ?? null,
    oidc_start_path: wired ? "/api/auth/oidc/start" : null,
    note: wired
      ? "OIDC PKCE flow available; register redirect URI at your IdP to match OIDC_REDIRECT_URI (defaults to {APP_URL}/api/auth/oidc/callback)."
      : "Set SSO_ISSUER (or OIDC_ISSUER) and OIDC_CLIENT_ID to enable SSO.",
  });
}
