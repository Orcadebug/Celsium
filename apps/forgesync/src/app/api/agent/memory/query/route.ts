import { badRequest, ok } from "../../_shared";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId || !sessionId.trim()) {
    return badRequest("Query parameter 'session_id' is required.");
  }

  return ok({
    ok: true,
    query: Object.fromEntries(searchParams),
    results: []
  });
}
