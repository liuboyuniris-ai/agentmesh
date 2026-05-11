import crypto from "node:crypto";

export const INVITE_TOKEN_BYTES = 32;

export function generateInvitePlainToken(): string {
  return crypto.randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
}

export function hashInviteToken(plain: string): string {
  return crypto.createHash("sha256").update(plain, "utf8").digest("hex");
}
