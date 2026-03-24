import { getSupabase } from "../../_supabase";
import { generateEmbedding } from "../../_embeddings";
import { ValidationError, badRequest, ok, requireAgentAuth } from "../../_shared";

export async function GET(req: Request) {
  try {
    requireAgentAuth(req);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const projectId = searchParams.get("project_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    if (!q) {
      return badRequest("Query parameter 'q' is required.");
    }

    const db = getSupabase();

    try {
      const queryEmbedding = await generateEmbedding(q, "RETRIEVAL_QUERY");
      const { data, error } = await db.rpc("match_cot_traces", {
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
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
