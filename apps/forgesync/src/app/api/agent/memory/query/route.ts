import { getSupabase } from "../../_supabase";
import { generateEmbedding } from "../../_embeddings";
import { RateLimitError, ValidationError, badRequest, ok, requireAgentAuth } from "../../_shared";

export async function GET(req: Request) {
  try {
    await requireAgentAuth(req);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const sessionId = searchParams.get("session_id");
    const projectId = searchParams.get("project_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    if (!q && !sessionId) {
      return badRequest("Query parameter 'q' or 'session_id' is required.");
    }

    const db = getSupabase();

    // Vector search if query text provided
    if (q) {
      try {
        const queryEmbedding = await generateEmbedding(q, "RETRIEVAL_QUERY");
        const { data, error } = await db.rpc("match_memories", {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: limit,
          filter_project_id: projectId || null,
        });

        if (error) {
          return badRequest(`Search error: ${error.message}`);
        }

        return ok({ ok: true, query: { q, project_id: projectId }, results: data || [] });
      } catch (err) {
        return badRequest(`Embedding error: ${(err as Error).message}`);
      }
    }

    // Fallback: fetch by session_id
    const query = db
      .from("memory_entries")
      .select("id, title, content, type, tags, created_at")
      .eq("session_id", sessionId!)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (projectId) {
      query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, query: { session_id: sessionId, project_id: projectId }, results: data || [] });
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
