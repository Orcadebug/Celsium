import { NextResponse } from "next/server";
import { processEmbeddingBatch } from "../../agent/_embeddings";

// Max jobs per invocation to stay within Vercel function timeout limits
const BATCH_SIZE = 50;

export async function POST(req: Request) {
  // Verify internal secret (separate from agent token)
  const internalSecret = process.env.FORGESYNC_INTERNAL_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  if (!internalSecret && !cronSecret) {
    return NextResponse.json({ ok: false, error: "Internal endpoint not configured" }, { status: 403 });
  }

  const provided = req.headers.get("x-forgesync-internal-key") || "";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const validSecrets = [internalSecret, cronSecret].filter((value): value is string => Boolean(value));

  if (!validSecrets.includes(provided) && !validSecrets.includes(bearer)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const result = await processEmbeddingBatch(BATCH_SIZE);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
