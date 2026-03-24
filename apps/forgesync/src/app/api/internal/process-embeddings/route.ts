import { NextResponse } from "next/server";
import { processEmbeddingBatch } from "../../agent/_embeddings";

export async function POST(req: Request) {
  // Verify internal secret (separate from agent token)
  const secret = process.env.FORGESYNC_INTERNAL_SECRET;
  if (secret) {
    const provided = req.headers.get("x-forgesync-internal-key") || "";
    if (provided !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processEmbeddingBatch(20);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
