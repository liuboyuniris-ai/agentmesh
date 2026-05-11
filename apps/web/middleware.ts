import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/sessionConstants";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${path}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/workspace",
    "/workspace/:path*",
    "/device",
    "/device/:path*",
  ],
};
