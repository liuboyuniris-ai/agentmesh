import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminRequest } from "@/lib/adminAuth";

const SLUG_RE = /^[a-z][a-z0-9-]{1,63}$/;

export async function GET(req: Request) {
  try {
    assertAdminRequest(req);
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }

  const rows = await prisma.agentListing.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ listings: rows });
}

export async function POST(req: Request) {
  try {
    assertAdminRequest(req);
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }

  const body = (await req.json()) as {
    slug?: string;
    name?: string;
    provider?: string;
    description?: string;
    isPublished?: boolean;
  };

  const slug = body.slug?.trim().toLowerCase();
  const name = body.name?.trim();
  const provider = body.provider?.trim();
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  if (!name || name.length === 0) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!provider || provider.length === 0) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  try {
    const row = await prisma.agentListing.create({
      data: {
        slug,
        name,
        provider,
        description,
        isPublished: Boolean(body.isPublished),
      },
    });
    return NextResponse.json({ listing: row });
  } catch {
    return NextResponse.json({ error: "create failed (duplicate slug?)" }, { status: 409 });
  }
}
