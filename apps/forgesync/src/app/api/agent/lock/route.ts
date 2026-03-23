import { ValidationError, badRequest, ok, readJsonObject, requireAgentAuth, requireString } from "../_shared";

export async function POST(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const resource = requireString(body, "resource");

    return ok({ ok: true, type: "lock", session_id: sessionId, resource, ttl_min: 30 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
