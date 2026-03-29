import { getSupabase } from "../../_supabase";
import { RateLimitError, ValidationError, badRequest, ok, requireAgentAuth } from "../../_shared";

export async function GET(req: Request) {
  try {
    await requireAgentAuth(req);

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    const agentId = url.searchParams.get("agent_id");
    const projectId = url.searchParams.get("project_id");

    if (!sessionId && !agentId) {
      return badRequest("Either 'session_id' or 'agent_id' query parameter is required.");
    }

    const db = getSupabase();
    let targetSessionId = sessionId;

    // If agent_id provided, find their most recent session
    if (!targetSessionId && agentId) {
      let query = db
        .from("sessions")
        .select("id, agent_id, intent, status, started_at, ended_at")
        .order("started_at", { ascending: false })
        .limit(1);

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      // agent_id is stored as text in the intent or we match by the agent_id column
      query = query.eq("agent_id", agentId);

      const { data: sessions, error: sessError } = await query.single();

      if (sessError || !sessions) {
        return ok({ ok: true, session: null, knowledge: [], locks: [], tasks: [] });
      }

      targetSessionId = sessions.id;
    }

    // Fetch the session
    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("id, agent_id, intent, status, started_at, ended_at")
      .eq("id", targetSessionId)
      .single();

    if (sessionError || !session) {
      return badRequest("Session not found.");
    }

    // Fetch all knowledge entries for this session
    const { data: knowledge } = await db
      .from("knowledge_entries")
      .select("id, kind, title, content, summary, metadata, tags, created_at")
      .eq("session_id", targetSessionId)
      .order("created_at", { ascending: true });

    // Fetch active locks from this session
    const { data: locks } = await db
      .from("file_locks")
      .select("path, expires_at")
      .eq("session_id", targetSessionId)
      .gt("expires_at", new Date().toISOString());

    // Fetch tasks claimed by this session
    const { data: tasks } = await db
      .from("tasks")
      .select("id, title, status")
      .eq("claimed_by_session", targetSessionId);

    return ok({
      ok: true,
      session,
      knowledge: knowledge || [],
      locks: locks || [],
      tasks: tasks || [],
    });
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
