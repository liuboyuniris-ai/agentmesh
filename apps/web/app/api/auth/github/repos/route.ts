import { NextResponse } from "next/server";
import { actorUserIdFromRequest } from "@/lib/auth";
import { resolveGithubAccessToken } from "@/lib/oauth/resolveGithubToken";
import { listGithubUserRepos } from "@/lib/oauth/githubRepos";

export async function GET(req: Request) {
  const userId = await actorUserIdFromRequest(req);
  const token = await resolveGithubAccessToken({ userId });
  if (!token) {
    return NextResponse.json(
      {
        error: "github_not_connected",
        message: "连接 GitHub OAuth 后即可浏览仓库列表。",
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("per_page") ?? "30") || 30)
  );

  try {
    const repos = await listGithubUserRepos({
      accessToken: token,
      page,
      perPage,
    });
    return NextResponse.json({ repos, page, per_page: perPage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
