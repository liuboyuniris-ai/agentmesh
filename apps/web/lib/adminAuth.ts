/** Protects internal admin HTTP APIs (marketplace CRUD, …). */
export function assertAdminRequest(req: Request): void {
  const secret = process.env.AGENTMESH_ADMIN_SECRET?.trim();
  if (!secret || secret.length < 8) {
    const e = new Error("Admin API disabled (set AGENTMESH_ADMIN_SECRET)");
    (e as Error & { status: number }).status = 503;
    throw e;
  }

  const header =
    req.headers.get("x-agentmesh-admin-secret")?.trim() ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!header || header !== secret) {
    const e = new Error("Unauthorized");
    (e as Error & { status: number }).status = 401;
    throw e;
  }
}
