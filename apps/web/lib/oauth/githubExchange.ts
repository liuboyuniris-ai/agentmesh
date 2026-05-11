export type GithubTokenExchangeResult = {
  access_token: string;
  scope?: string;
};

export async function exchangeGithubOAuthCode(
  code: string
): Promise<GithubTokenExchangeResult> {
  const id = process.env.GITHUB_CLIENT_ID?.trim();
  const secret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    throw new Error("GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured");
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      code,
    }),
  });

  const json = (await res.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? "GitHub OAuth token exchange failed"
    );
  }

  return { access_token: json.access_token, scope: json.scope };
}
