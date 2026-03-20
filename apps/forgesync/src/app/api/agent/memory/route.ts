import { ValidationError, badRequest, ok, readJsonObject, requireString } from "../_shared";

export async function POST(req: Request) {
  try {
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const content = requireString(body, "content");

    return ok({ ok: true, type: "memory", session_id: sessionId, saved: true, content });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
