/**
 * Base URL used for GitHub OAuth redirect_uri and post-login redirects.
 *
 * In development, use only the URL the browser requested (`req.url` origin). Do not
 * trust X-Forwarded-* (stale proxy / ngrok headers cause redirect_uri mismatch on GitHub).
 * In production, prefer NEXT_PUBLIC_APP_URL, then forwarded host, then request origin.
 */
export function oauthPublicBase(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim() ?? "";

  const fromRequestUrl = (): string | null => {
    try {
      return new URL(req.url).origin;
    } catch {
      return null;
    }
  };

  if (process.env.NODE_ENV === "development") {
    return fromRequestUrl() ?? (fromEnv || "http://localhost:3000");
  }

  if (fromEnv) return fromEnv;

  const xfHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const xfProto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]?.trim();
  if (xfHost) {
    const proto = xfProto && xfProto.length > 0 ? xfProto : "https";
    return `${proto}://${xfHost}`;
  }

  return fromRequestUrl() ?? "http://localhost:3000";
}
