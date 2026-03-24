// DEPRECATED: Use POST /api/agent/knowledge with kind="decision" instead.
import { getSupabase } from "../_supabase";
import { enqueueEmbedding, enqueueSummarize } from "../_embeddings";
import { ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString } from "../_shared";

export async function POST(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const decision = requireString(body, "decision");
    const rationale = optionalString(body, "rationale");
    const projectId = optionalString(body, "project_id");

    const db = getSupabase();
    const { data, error } = await db
      .from("decisions")
      .insert({
        project_id: projectId || null,
        session_id: sessionId,
        title: decision,
        chosen_approach: decision,
        rationale: rationale || null,
      })
      .select("id")
      .single();

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    // Enqueue embedding for semantic search (legacy table)
    const textToEmbed = rationale ? `${decision}\n${rationale}` : decision;
    await enqueueEmbedding("decisions", data.id, textToEmbed);

    // Dual-write to unified knowledge_entries table
    const { data: keData } = await db
      .from("knowledge_entries")
      .insert({
        project_id: projectId || null,
        session_id: sessionId,
        kind: "decision",
        title: decision,
        content: decision,
        metadata: { rationale: rationale || null },
        tags: [],
      })
      .select("id")
      .single();

    if (keData) {
      await enqueueSummarize(keData.id, textToEmbed);
    }

    return ok({ ok: true, type: "decision", id: data.id, session_id: sessionId, decision });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
