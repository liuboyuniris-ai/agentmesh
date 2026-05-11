import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  handleGithubLinkTokenCallback,
  handleGithubSignInCallback,
} from "@/lib/oauth/githubOAuthHandlers";
import { oauthPublicBase } from "@/lib/oauth/oauthPublicBase";
import { absoluteUrl } from "@/lib/oauth/safeReturnPath";

/**
 * Single OAuth redirect URI for GitHub OAuth Apps that only allow one callback URL.
 * Dispatches by cookie: gh_signin_state (login) vs gh_oauth_state (link token).
 */
export async function GET(req: Request) {
  const jar = cookies();
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const signinExpected = jar.get("gh_signin_state")?.value ?? "";
  const linkExpected = jar.get("gh_oauth_state")?.value ?? "";

  if (state && signinExpected && state === signinExpected) {
    return handleGithubSignInCallback(req);
  }
  if (state && linkExpected && state === linkExpected) {
    return handleGithubLinkTokenCallback(req);
  }

  if (signinExpected) {
    return handleGithubSignInCallback(req);
  }
  if (linkExpected) {
    return handleGithubLinkTokenCallback(req);
  }

  const appBase = oauthPublicBase(req);
  return NextResponse.redirect(
    absoluteUrl(appBase, `/login?github_error=oauth_state`),
    302
  );
}
