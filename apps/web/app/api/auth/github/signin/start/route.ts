import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { oauthPublicBase } from "@/lib/oauth/oauthPublicBase";
import { safeGithubOAuthReturnPath } from "@/lib/oauth/safeReturnPath";

/**
 * GitHub OAuth used to **sign in** (create session), not only link token.
 * Requires same GitHub App as repo linking; user must authorize `read:user` (and email if needed).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const appBase = oauthPublicBase(req);
  const returnTo = safeGithubOAuthReturnPath(
    url.searchParams.get("return_to"),
    `${appBase}/dashboard`
  );
  const redirectUri = `${appBase}/api/auth/github/callback`;
  const state = randomUUID();
  const scope =
    process.env.GITHUB_OAUTH_SCOPE ?? "read:user user:email";

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize.toString(), 302);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("gh_signin_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 600,
  });
  if (returnTo) {
    res.cookies.set("gh_signin_return", returnTo, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      maxAge: 600,
    });
  }
  return res;
}
