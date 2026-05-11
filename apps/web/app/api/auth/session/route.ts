import { NextResponse } from "next/server";
import { actorUserIdFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const userId = await actorUserIdFromRequest(req);
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true },
  });
  if (!row) {
    return NextResponse.json({
      user: {
        id: userId,
        email: null as string | null,
        displayName: null as string | null,
        provisional: true,
      },
    });
  }
  return NextResponse.json({ user: row });
}
