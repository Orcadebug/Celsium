import { ValidationError, badRequest, ok, readJsonObject, requireString } from "../../_shared";

export async function POST(req: Request) {
  try {
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const taskId = requireString(body, "task_id");

    return ok({ ok: true, type: "task_claim", session_id: sessionId, task_id: taskId });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
