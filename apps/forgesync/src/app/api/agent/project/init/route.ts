import { getSupabase } from "../../_supabase";
import { RateLimitError, ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString } from "../../_shared";

export async function POST(req: Request) {
  try {
    await requireAgentAuth(req);
    const body = await readJsonObject(req);

    const projectId = requireString(body, "projectId");
    const repositoryRoot = requireString(body, "repositoryRoot");
    const createdAt = requireString(body, "createdAt");
    const apiBaseUrl = optionalString(body, "apiBaseUrl");

    const db = getSupabase();
    const { error } = await db.from("projects").upsert(
      { id: projectId, name: repositoryRoot, repo_url: repositoryRoot, created_at: createdAt },
      { onConflict: "id" }
    );

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({
      ok: true,
      project_id: projectId,
      linked: true,
      received: {
        repository_root: repositoryRoot,
        created_at: createdAt,
        api_base_url: apiBaseUrl,
      },
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
