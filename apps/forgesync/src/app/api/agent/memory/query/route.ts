import { ValidationError, badRequest, ok, requireAgentAuth } from "../../_shared";

export async function GET(req: Request) {
  try {
    requireAgentAuth(req);

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
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
