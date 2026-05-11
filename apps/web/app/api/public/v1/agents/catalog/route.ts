import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowPublicRequest } from "@/lib/rateLimit";

/**
 * Agent catalog (published marketplace rows).
 */
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

  const rows = await prisma.agentListing.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    agents: rows.map((a) => ({
      id: a.slug,
      name: a.name,
      provider: a.provider,
      description: a.description,
    })),
  });
}
