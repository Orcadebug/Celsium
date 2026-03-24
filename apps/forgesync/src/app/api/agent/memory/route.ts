// DEPRECATED: Use POST /api/agent/knowledge with kind="memory" instead.
import { getSupabase } from "../_supabase";
import { enqueueEmbedding, enqueueSummarize } from "../_embeddings";
import { ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString } from "../_shared";

export async function POST(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const content = requireString(body, "content");
    const title = optionalString(body, "title");
    const type = optionalString(body, "type") || "general";
    const projectId = optionalString(body, "project_id");

    const db = getSupabase();
    const { data, error } = await db
      .from("memory_entries")
      .insert({
        project_id: projectId || null,
        session_id: sessionId,
        type,
        title: title || content.slice(0, 100),
        content,
      })
      .select("id")
      .single();

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    // Enqueue embedding for semantic search (legacy table)
    const textToEmbed = title ? `${title}\n${content}` : content;
    await enqueueEmbedding("memory_entries", data.id, textToEmbed);

    // Dual-write to unified knowledge_entries table
    const { data: keData } = await db
      .from("knowledge_entries")
      .insert({
        project_id: projectId || null,
        session_id: sessionId,
        kind: "memory",
        title: title || content.slice(0, 100),
        content,
        metadata: { type },
        tags: [],
      })
      .select("id")
      .single();

    if (keData) {
      await enqueueSummarize(keData.id, textToEmbed);
    }

    return ok({ ok: true, type: "memory", id: data.id, session_id: sessionId, saved: true, content });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
