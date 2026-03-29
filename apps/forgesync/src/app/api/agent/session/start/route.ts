import { getSupabase } from "../../_supabase";
import { generateEmbedding } from "../../_embeddings";
import { RateLimitError, ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString, logger, logAudit, extractClientIp, extractTokenHint } from "../../_shared";

export async function POST(req: Request) {
  const start = Date.now();
  const ip = extractClientIp(req);
  const tokenHint = extractTokenHint(req);

  try {
    await requireAgentAuth(req);
    const body = await readJsonObject(req);
    const agentId = requireString(body, "agent_id");
    const runId = optionalString(body, "run_id");
    const intent = optionalString(body, "intent");
    const projectId = optionalString(body, "project_id");

    const db = getSupabase();

    // Insert session
    const { data: session, error: sessionError } = await db
      .from("sessions")
      .insert({
        project_id: projectId || null,
        agent_id: null,
        agent_name: agentId,
        intent,
        status: "active",
      })
      .select("id")
      .single();

    if (sessionError) {
      logAudit({ action: "session.start", agent_id: agentId, project_id: projectId, ip, token_hint: tokenHint, status: "failure", error: sessionError.message, duration_ms: Date.now() - start });
      return badRequest(`DB error: ${sessionError.message}`);
    }

    logger.info("session started", { session_id: session.id, agent_id: agentId, project_id: projectId });

    // Hydrate context from all layers
    let projectDna = {};
    let relevantKnowledge: unknown[] = [];
    let lockedFiles: unknown[] = [];
    let activeSessions: unknown[] = [];
    let openTasks: unknown[] = [];

    if (projectId) {
      // Layer 1: Project DNA
      const { data: project } = await db
        .from("projects")
        .select("dna")
        .eq("id", projectId)
        .single();
      if (project) {
        projectDna = project.dna || {};
      }

      // Layer 2: Active State
      const [locksResult, sessionsResult, tasksResult] = await Promise.all([
        db.from("file_locks").select("path, session_id, expires_at").eq("project_id", projectId),
        db.from("sessions").select("id, agent_id, intent, started_at").eq("project_id", projectId).eq("status", "active"),
        db.from("tasks").select("id, title, status, claimed_by_session").eq("project_id", projectId).neq("status", "completed"),
      ]);

      lockedFiles = locksResult.data || [];
      activeSessions = sessionsResult.data || [];
      openTasks = tasksResult.data || [];

      // Layer 3: Unified semantic search (if intent provided)
      if (intent) {
        try {
          const queryEmbedding = await generateEmbedding(intent, "RETRIEVAL_QUERY");

          const { data: knowledgeResult } = await db.rpc("match_knowledge", {
            query_embedding: queryEmbedding,
            filter_kinds: null,
            match_threshold: 0.5,
            match_count: 20,
            filter_project_id: projectId,
          });

          relevantKnowledge = knowledgeResult || [];
        } catch (err) {
          logger.warn("semantic search failed, returning empty context", { error: (err as Error).message, project_id: projectId });
        }
      }
    }

    logAudit({ action: "session.start", agent_id: agentId, session_id: session.id, project_id: projectId, ip, token_hint: tokenHint, status: "success", duration_ms: Date.now() - start });

    return ok({
      ok: true,
      session_id: session.id,
      received: { agent_id: agentId, run_id: runId },
      context: {
        project_dna: projectDna,
        relevant_knowledge: relevantKnowledge,
        locked_files: lockedFiles,
        active_sessions: activeSessions,
        open_tasks: openTasks,
      },
    });
  } catch (error) {
    logAudit({ action: "session.start", ip, token_hint: tokenHint, status: "failure", error: (error as Error).message, duration_ms: Date.now() - start });

    if (error instanceof RateLimitError) {
      return error.response;
    }
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
