export type GithubRepoListItem = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  html_url: string;
  description: string | null;
  updated_at?: string | null;
};

/**
 * List repos visible to the user (owned, collaborator, org member).
 */
export async function listGithubUserRepos(params: {
  accessToken: string;
  page?: number;
  perPage?: number;
}): Promise<GithubRepoListItem[]> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 30));
  const url = new URL("https://api.github.com/user/repos");
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "updated");
  url.searchParams.set(
    "affiliation",
    "owner,collaborator,organization_member"
  );

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${params.accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub API ${res.status}: ${t.slice(0, 500)}`);
  }

  const json = (await res.json()) as Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    default_branch?: string | null;
    clone_url: string;
    html_url: string;
    description: string | null;
    updated_at?: string | null;
  }>;

  if (!Array.isArray(json)) {
    return [];
  }

  return json.map((r) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    private: r.private,
    default_branch: r.default_branch?.trim() || "main",
    clone_url: r.clone_url,
    html_url: r.html_url,
    description: r.description,
    updated_at: r.updated_at ?? null,
  }));
}
