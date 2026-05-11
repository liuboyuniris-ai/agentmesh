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
        message: "Connect GitHub OAuth first.",
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const maxPages = Math.min(5, Math.max(1, Number(url.searchParams.get("max_pages") ?? "3") || 3));

  try {
    const aggregated: Awaited<ReturnType<typeof listGithubUserRepos>> = [];
    for (let page = 1; page <= maxPages; page++) {
      const batch = await listGithubUserRepos({
        accessToken: token,
        page,
        perPage: 100,
      });
      aggregated.push(...batch);
      if (batch.length < 100) break;
    }

    let filtered = aggregated;
    if (q.length > 0) {
      filtered = aggregated.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q) ?? false)
      );
    }

    const repos = filtered.map((r) => ({
      fullName: r.full_name,
      private: r.private,
      updatedAt: r.updated_at ?? null,
      description: r.description,
      cloneUrl: r.clone_url,
    }));

    return NextResponse.json({ repos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
