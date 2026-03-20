import { ValidationError, badRequest, ok, optionalString, readJsonObject, requireString } from "../../_shared";

export async function POST(req: Request) {
  try {
    const body = await readJsonObject(req);
    const agentId = requireString(body, "agent_id");
    const runId = optionalString(body, "run_id");

    return ok({
      ok: true,
      session_id: crypto.randomUUID(),
      received: {
        agent_id: agentId,
        run_id: runId
      },
      context: {
        recent_decisions: [],
        relevant_memory: [],
        active_sessions: [],
        locked_files: [],
        open_tasks: [],
        constraints: [],
        patterns: []
      }
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
