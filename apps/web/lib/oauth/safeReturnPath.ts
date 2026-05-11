/**
 * GitHub OAuth: only allow same-app relative redirects (avoid open redirects).
 */
export function safeGithubOAuthReturnPath(
  raw: string | null | undefined,
  appBaseUrl: string
): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (t.length > 2048) return null;

  if (t.startsWith("/") && !t.startsWith("//") && !t.includes("\\")) {
    if (t.includes("://")) return null;
    return t;
  }

  try {
    const u = new URL(t);
    const base = new URL(appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`);
    if (u.origin !== base.origin) return null;
    if (!u.pathname.startsWith("/")) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export function absoluteUrl(appBase: string, pathWithQuery: string): string {
  const base = appBase.replace(/\/$/, "");
  return new URL(pathWithQuery, `${base}/`).toString();
}
