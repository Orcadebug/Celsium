import { getSupabase } from "../../_supabase";
import { generateEmbedding } from "../../_embeddings";
import { RateLimitError, ValidationError, badRequest, ok, requireAgentAuth } from "../../_shared";

export async function GET(req: Request) {
  try {
    await requireAgentAuth(req);

    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    const kindsParam = url.searchParams.get("kinds");
    const projectId = url.searchParams.get("project_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10) || 10, 50);

    if (!q) {
      return badRequest("Query parameter 'q' is required.");
    }

    const filterKinds = kindsParam
      ? kindsParam.split(",").map((k) => k.trim()).filter(Boolean)
      : null;

    const queryEmbedding = await generateEmbedding(q, "RETRIEVAL_QUERY");

    const db = getSupabase();
    const { data, error } = await db.rpc("match_knowledge", {
      query_embedding: queryEmbedding,
      filter_kinds: filterKinds,
      match_threshold: 0.5,
      match_count: limit,
      filter_project_id: projectId || null,
    });

    if (error) {
      return badRequest(`Search error: ${error.message}`);
    }

    return ok({
      ok: true,
      query: { q, kinds: filterKinds, project_id: projectId },
      results: data || [],
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
