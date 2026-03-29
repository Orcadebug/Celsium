import { getSupabase } from "../../_supabase";
import { RateLimitError, ValidationError, badRequest, ok, readJsonObject, requireAgentAuth, requireString } from "../../_shared";

export async function POST(req: Request) {
  try {
    await requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");

    const db = getSupabase();
    const { error } = await db
      .from("sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "active");

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, session_id: sessionId, ended: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return error.response;
    }
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
