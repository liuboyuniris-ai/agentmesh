import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeGithubOAuthCode } from "@/lib/oauth/githubExchange";
import { sealOAuthToken } from "@/lib/crypto/oauthToken";
import { oauthPublicBase } from "@/lib/oauth/oauthPublicBase";
import { absoluteUrl } from "@/lib/oauth/safeReturnPath";
import {
  appendSessionCookie,
  createBrowserSession,
} from "@/lib/sessionIssue";

const GH_UA = "AgentMesh-OAuth/1.0";

async function githubUser(accessToken: string): Promise<{
  login: string;
  id: number;
  email: string | null;
}> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": GH_UA,
    },
  });
  if (!res.ok) {
    throw new Error(`github user: ${res.status}`);
  }
  const j = (await res.json()) as {
    login?: string;
    id?: number;
    email?: string | null;
  };
  const login = typeof j.login === "string" ? j.login : null;
  if (!login || typeof j.id !== "number") {
    throw new Error("github user payload");
  }
  let email = typeof j.email === "string" ? j.email : null;
  if (!email) {
    const eres = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": GH_UA,
      },
    });
    if (eres.ok) {
      const list = (await eres.json()) as {
        email?: string;
        primary?: boolean;
        verified?: boolean;
      }[];
      const primary =
        list?.find((e) => e.primary && e.email)?.email ??
        list?.find((e) => e.email)?.email;
      email = primary ?? null;
    }
  }
  return { login, id: j.id, email };
}

/** GitHub «Sign in» flow (session + user bootstrap). */
export async function handleGithubSignInCallback(
  req: Request
): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appBase = oauthPublicBase(req);

  const jar = cookies();
  const expectedState = jar.get("gh_signin_state")?.value;
  const returnPath = jar.get("gh_signin_return")?.value ?? null;

  const secure = process.env.NODE_ENV === "production";
  const clear = (res: NextResponse) => {
    for (const name of ["gh_signin_state", "gh_signin_return"]) {
      res.cookies.set(name, "", {
        httpOnly: true,
        path: "/",
        secure,
        maxAge: 0,
      });
    }
  };

  const redirectLogin = (q: string) => {
    const res = NextResponse.redirect(
      absoluteUrl(appBase, `/login?${q}`),
      302
    );
    clear(res);
    return res;
  };

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectLogin("github_error=oauth_state");
  }

  let tokens;
  try {
    tokens = await exchangeGithubOAuthCode(code);
  } catch {
    return redirectLogin("github_error=exchange");
  }

  let gh;
  try {
    gh = await githubUser(tokens.access_token);
  } catch {
    return redirectLogin("github_error=user");
  }

  const loginLower = gh.login.toLowerCase();
  const userIdBase = `gh_${loginLower.replace(/[^a-z0-9_-]/g, "_")}`;
  let userId = userIdBase;
  if (userId.length < 3) {
    userId = `gh_${createHash("sha256").update(String(gh.id)).digest("hex").slice(0, 12)}`;
  }

  const emailNorm = gh.email?.trim().toLowerCase() ?? null;

  let resolvedUserId: string;

  const byEmail =
    emailNorm != null
      ? await prisma.user.findUnique({
          where: { email: emailNorm },
        })
      : null;

  if (byEmail) {
    resolvedUserId = byEmail.id;
  } else {
    const existingGhId = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (existingGhId) {
      resolvedUserId = existingGhId.id;
    } else {
      let candidate = userId;
      let n = 0;
      while (await prisma.user.findUnique({ where: { id: candidate } })) {
        n += 1;
        candidate = `${userIdBase}_${n}`;
        if (n > 30) {
          candidate = `gh_${randomBytes(8).toString("hex")}`;
          break;
        }
      }
      await prisma.user.create({
        data: {
          id: candidate,
          email: emailNorm,
          displayName: gh.login,
          passwordHash: null,
        },
      });
      resolvedUserId = candidate;
    }
  }

  await prisma.oAuthConnection.upsert({
    where: { userId_provider: { userId: resolvedUserId, provider: "github" } },
    create: {
      userId: resolvedUserId,
      provider: "github",
      accessToken: sealOAuthToken(tokens.access_token),
      scope: tokens.scope ?? null,
      metadata: { github_login: gh.login, github_id: gh.id },
    },
    update: {
      accessToken: sealOAuthToken(tokens.access_token),
      scope: tokens.scope ?? undefined,
      metadata: { github_login: gh.login, github_id: gh.id },
    },
  });

  const { rawToken } = await createBrowserSession(resolvedUserId);
  const target =
    returnPath && returnPath.startsWith("/") && !returnPath.startsWith("//")
      ? returnPath
      : "/dashboard";
  const res = NextResponse.redirect(absoluteUrl(appBase, target), 302);
  appendSessionCookie(res, rawToken);
  clear(res);
  return res;
}

/** Link GitHub token for an already-logged-in user (repo clone). */
export async function handleGithubLinkTokenCallback(
  req: Request
): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appBase = oauthPublicBase(req);

  const jar = cookies();
  const expectedState = jar.get("gh_oauth_state")?.value;
  const userId = jar.get("gh_oauth_user_id")?.value;
  const returnPath = jar.get("gh_oauth_return")?.value ?? null;

  const clearOauthCookies = (res: NextResponse) => {
    const secure = process.env.NODE_ENV === "production";
    for (const name of [
      "gh_oauth_state",
      "gh_oauth_user_id",
      "gh_oauth_return",
    ]) {
      res.cookies.set(name, "", {
        httpOnly: true,
        path: "/",
        secure,
        maxAge: 0,
      });
    }
  };

  const redirectAfter = (pathWithSearch: string) => {
    const res = NextResponse.redirect(
      absoluteUrl(appBase, pathWithSearch),
      302
    );
    clearOauthCookies(res);
    return res;
  };

  const redirectDashboard = (search: string) => {
    const res = NextResponse.redirect(`${appBase}/dashboard${search}`, 302);
    clearOauthCookies(res);
    return res;
  };

  if (!code || !state || !expectedState || state !== expectedState || !userId) {
    return redirectDashboard("?github_error=oauth_state");
  }

  try {
    const tokens = await exchangeGithubOAuthCode(code);
    await prisma.oAuthConnection.upsert({
      where: {
        userId_provider: { userId, provider: "github" },
      },
      create: {
        userId,
        provider: "github",
        accessToken: sealOAuthToken(tokens.access_token),
        scope: tokens.scope ?? null,
      },
      update: {
        accessToken: sealOAuthToken(tokens.access_token),
        scope: tokens.scope ?? null,
      },
    });
  } catch {
    return redirectDashboard("?github_error=exchange");
  }

  const target =
    returnPath && returnPath.startsWith("/") && !returnPath.startsWith("//")
      ? (() => {
          const u = new URL(returnPath, `${appBase}/`);
          u.searchParams.set("github", "connected");
          return `${u.pathname}${u.search}${u.hash}`;
        })()
      : "/dashboard?github=connected";

  return redirectAfter(target);
}
