import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorUserIdFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const userId = await actorUserIdFromRequest(req);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = user?.email?.trim().toLowerCase() ?? null;

  const invitations = await prisma.workspaceInvite.findMany({
    where: {
      status: "pending",
      OR: [
        { inviteeUserId: userId },
        ...(email ? [{ inviteeEmail: email }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      workspace: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ invitations });
}
