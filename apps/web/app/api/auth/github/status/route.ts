import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";

export async function GET(_req: Request) {
  const userId = await actorUserIdFromRequest(_req);
  const row = await prisma.oAuthConnection.findUnique({
    where: {
      userId_provider: { userId, provider: "github" },
    },
    select: { id: true, scope: true, updatedAt: true },
  });

  return NextResponse.json({
    connected: Boolean(row),
    scope: row?.scope ?? null,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  });
}
