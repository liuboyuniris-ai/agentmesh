import crypto from "node:crypto";

/**
 * AES-256-GCM sealing for GitHub/OIDC tokens at rest.
 *
 * Production / staging: set AGENTMESH_OAUTH_SECRET (≥16 characters). Without it,
 * tokens are stored as plaintext (convenient for local dev only).
 */
const PREFIX = "enc:v1:";

function deriveKey(): Buffer | null {
  const secret = process.env.AGENTMESH_OAUTH_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  return crypto.scryptSync(secret, "agentmesh-oauth-v1", 32);
}

/** When AGENTMESH_OAUTH_SECRET is unset or too short, returns plaintext (dev). */
export function sealOAuthToken(plain: string): string {
  const key = deriveKey();
  if (!key) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, tag, enc]);
  return `${PREFIX}${blob.toString("base64url")}`;
}

export function openOAuthToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = deriveKey();
  if (!key) {
    throw new Error(
      "Stored OAuth token is encrypted but AGENTMESH_OAUTH_SECRET is missing"
    );
  }
  const blob = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}
