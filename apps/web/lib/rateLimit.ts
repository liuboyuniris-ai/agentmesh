const buckets = new Map<string, { n: number; reset: number }>();

function limitFromEnv(): number {
  const raw = process.env.AGENTMESH_PUBLIC_RATE_LIMIT_PER_MIN?.trim();
  const n = raw ? Number(raw) : 120;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

/**
 * Very small in-memory rate limiter for unauthenticated public endpoints.
 */
export function allowPublicRequest(req: Request): boolean {
  const limit = limitFromEnv();
  const windowMs = 60_000;
  const ip = clientIp(req);
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.reset) {
    buckets.set(ip, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= limit) return false;
  b.n++;
  return true;
}
