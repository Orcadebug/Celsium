import { ValidationError, badRequest, ok, readJsonObject, requireAgentAuth, requireString } from "../_shared";

export async function POST(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const decision = requireString(body, "decision");

    return ok({ ok: true, type: "decision", session_id: sessionId, decision });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
