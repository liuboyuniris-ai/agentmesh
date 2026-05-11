/** Public web origin for links in email and OAuth device verification (no trailing slash). */
export function getPublicAppOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");

  const xfHost = req.headers.get("x-forwarded-host")?.trim();
  const host = xfHost || req.headers.get("host")?.trim();
  const xfProto = req.headers.get("x-forwarded-proto")?.trim();
  const proto = xfProto && xfProto.length ? xfProto : "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}
