import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminRequest } from "@/lib/adminAuth";

export async function PATCH(
  req: Request,
  ctx: { params: { slug: string } }
) {
  try {
    assertAdminRequest(req);
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }

  const slug = ctx.params.slug.trim().toLowerCase();
  const body = (await req.json()) as {
    name?: string;
    provider?: string;
    description?: string;
    isPublished?: boolean;
  };

  const data: {
    name?: string;
    provider?: string;
    description?: string;
    isPublished?: boolean;
  } = {};

  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: "invalid name" }, { status: 400 });
    data.name = n;
  }
  if (typeof body.provider === "string") {
    const p = body.provider.trim();
    if (!p) return NextResponse.json({ error: "invalid provider" }, { status: 400 });
    data.provider = p;
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim();
  }
  if (typeof body.isPublished === "boolean") {
    data.isPublished = body.isPublished;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  try {
    const row = await prisma.agentListing.update({
      where: { slug },
      data,
    });
    return NextResponse.json({ listing: row });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: { slug: string } }
) {
  try {
    assertAdminRequest(req);
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }

  const slug = ctx.params.slug.trim().toLowerCase();

  try {
    await prisma.agentListing.delete({ where: { slug } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
