export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  try {
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
