import { prisma } from "@/lib/prisma";
import { openOAuthToken } from "@/lib/crypto/oauthToken";

/** Prefer explicit body token, then env PAT, then stored OAuth token for userId. */
export async function resolveGithubAccessToken(params: {
  userId: string;
  explicit?: string | null;
}): Promise<string | undefined> {
  const t = params.explicit?.trim();
  if (t) return t;

  const env =
    process.env.GITHUB_TOKEN?.trim() ??
    process.env.GITHUB_PAT?.trim() ??
    "";
  if (env) return env;

  const row = await prisma.oAuthConnection.findUnique({
    where: {
      userId_provider: { userId: params.userId, provider: "github" },
    },
  });

  const raw = row?.accessToken?.trim();
  if (!raw) return undefined;
  try {
    return openOAuthToken(raw);
  } catch {
    return undefined;
  }
}
