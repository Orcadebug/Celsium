import { ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString } from "../../_shared";

export async function POST(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);

    const projectId = requireString(body, "projectId");
    const repositoryRoot = requireString(body, "repositoryRoot");
    const createdAt = requireString(body, "createdAt");
    const apiBaseUrl = optionalString(body, "apiBaseUrl");

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
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
