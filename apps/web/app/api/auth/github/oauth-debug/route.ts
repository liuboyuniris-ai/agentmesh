import { NextResponse } from "next/server";
import { oauthPublicBase } from "@/lib/oauth/oauthPublicBase";

/** Development helper: exact redirect URI to paste into GitHub (single-callback OAuth Apps). */
export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const appBase = oauthPublicBase(req);
  const redirect_uri = `${appBase}/api/auth/github/callback`;
  return NextResponse.json({
    appBase,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
    github_oauth_app: {
      redirect_uri,
      authorization_callback_url: redirect_uri,
    },
    signin_start: `${appBase}/api/auth/github/signin/start`,
    link_repo_start: `${appBase}/api/auth/github/start`,
    legacy_redirect: `${appBase}/api/auth/github/signin/callback`,
    note: "Use redirect_uri above as the only Authorization callback URL on GitHub. Login and «connect repo» both return here.",
  });
}
