import { getSupabase } from "../../_supabase";
import { ValidationError, badRequest, ok, readJsonObject, requireAgentAuth, requireString } from "../../_shared";

export async function POST(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const taskId = requireString(body, "task_id");

    const db = getSupabase();
    const { error } = await db
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", taskId)
      .eq("claimed_by_session", sessionId);

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, type: "task_complete", session_id: sessionId, task_id: taskId });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
