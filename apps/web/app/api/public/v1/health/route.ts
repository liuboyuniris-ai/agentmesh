import { NextResponse } from "next/server";
import { allowPublicRequest } from "@/lib/rateLimit";

const VERSION = "0.2.0";

export async function GET(req: Request) {
  if (!allowPublicRequest(req)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const expected = process.env.AGENTMESH_PUBLIC_API_KEY?.trim();
  if (expected) {
    const key = req.headers.get("x-agentmesh-api-key")?.trim();
    if (key !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.json({
    ok: true,
    service: "agentmesh",
    version: VERSION,
    ts: new Date().toISOString(),
  });
}
