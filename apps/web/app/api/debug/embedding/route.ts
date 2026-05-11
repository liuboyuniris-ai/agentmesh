import { NextResponse } from "next/server";
import { getEmbeddingConfigDebug } from "@/lib/context/embeddings";

/** Dev-only: which embedding backend and Gemini model id the server will use (no secrets). */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(getEmbeddingConfigDebug());
}
