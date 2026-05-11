import { NextResponse } from "next/server";

/**
 * Legacy path: GitHub OAuth Apps with only one slot should use
 * `/api/auth/github/callback` only. This redirect keeps old registrations working.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dest = new URL("/api/auth/github/callback", url.origin);
  dest.search = url.search;
  return NextResponse.redirect(dest.toString(), 307);
}
