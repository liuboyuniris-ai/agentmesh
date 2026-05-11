import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";

export async function DELETE(_req: Request) {
  const userId = await actorUserIdFromRequest(_req);

  await prisma.oAuthConnection.deleteMany({
    where: { userId, provider: "github" },
  });

  return NextResponse.json({ ok: true });
}
