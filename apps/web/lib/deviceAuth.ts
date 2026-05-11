import crypto from "node:crypto";

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateDeviceCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashDeviceCode(deviceCode: string): string {
  return crypto.createHash("sha256").update(deviceCode, "utf8").digest("hex");
}

export function generateUserCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += USER_CODE_ALPHABET[crypto.randomInt(USER_CODE_ALPHABET.length)]!;
  }
  return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

export function normalizeUserCode(input: string): string {
  const compact = input.trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (compact.length === 8) return `${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export const USER_CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
