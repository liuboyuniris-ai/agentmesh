import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySessionFromRequest,
} from "@/lib/sessionIssue";

export async function POST(req: Request) {
  await destroySessionFromRequest(req);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
