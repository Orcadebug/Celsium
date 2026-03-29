import { getSupabase } from "../_supabase";
import { RateLimitError, ValidationError, badRequest, ok, requireAgentAuth } from "../_shared";

export async function GET(req: Request) {
  try {
    await requireAgentAuth(req);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    const db = getSupabase();
    const now = new Date().toISOString();

    let query = db
      .from("file_locks")
      .select("id, path, session_id, expires_at, created_at")
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, locks: data || [] });
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
