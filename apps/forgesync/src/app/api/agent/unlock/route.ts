import { getSupabase } from "../_supabase";
import { RateLimitError, ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString } from "../_shared";

export async function POST(req: Request) {
  try {
    await requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const resource = requireString(body, "resource");
    const projectId = optionalString(body, "project_id");

    const db = getSupabase();

    let deleteQuery = db
      .from("file_locks")
      .delete()
      .eq("path", resource)
      .eq("session_id", sessionId);

    if (projectId) {
      deleteQuery = deleteQuery.eq("project_id", projectId);
    }

    const { error, count } = await deleteQuery;

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, type: "unlock", session_id: sessionId, resource });
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
