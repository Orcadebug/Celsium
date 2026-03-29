import { getSupabase } from "../_supabase";
import { enqueueSummarize } from "../_embeddings";
import {
  RateLimitError,
  ValidationError,
  badRequest,
  ok,
  optionalString,
  readJsonObject,
  requireAgentAuth,
  requireString,
} from "../_shared";

const VALID_KINDS = ["memory", "decision", "cot", "artifact", "intent", "file"];

export async function POST(req: Request) {
  try {
    await requireAgentAuth(req);
    const body = await readJsonObject(req);

    const sessionId = requireString(body, "session_id");
    const kind = requireString(body, "kind");
    const title = requireString(body, "title");
    const content = requireString(body, "content");
    const projectId = optionalString(body, "project_id");

    if (!VALID_KINDS.includes(kind)) {
      return badRequest(`Field 'kind' must be one of: ${VALID_KINDS.join(", ")}`);
    }

    const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

    const tags = Array.isArray(body.tags) && body.tags.every((t: unknown) => typeof t === "string")
      ? body.tags
      : [];

    const db = getSupabase();
    const { data, error } = await db
      .from("knowledge_entries")
      .insert({
        project_id: projectId || null,
        session_id: sessionId,
        kind,
        title,
        content,
        metadata,
        tags,
      })
      .select("id")
      .single();

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    // Enqueue AI summarization (phase 1 of 2-phase pipeline)
    await enqueueSummarize(data.id, `${title}\n${content}`);

    return ok({
      ok: true,
      id: data.id,
      kind,
      session_id: sessionId,
      summary_pending: true,
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
