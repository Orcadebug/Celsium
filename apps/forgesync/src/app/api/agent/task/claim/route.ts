import { NextResponse } from "next/server";
import { getSupabase } from "../../_supabase";
import { ValidationError, badRequest, ok, readJsonObject, requireAgentAuth, requireString } from "../../_shared";

export async function POST(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const taskId = requireString(body, "task_id");

    const db = getSupabase();

    // Check task is open and unclaimed
    const { data: task, error: fetchError } = await db
      .from("tasks")
      .select("id, status, claimed_by_session")
      .eq("id", taskId)
      .single();

    if (fetchError || !task) {
      return badRequest(`Task '${taskId}' not found.`);
    }

    if (task.claimed_by_session && task.claimed_by_session !== sessionId) {
      return NextResponse.json(
        { ok: false, error: `Task '${taskId}' is already claimed by session ${task.claimed_by_session}` },
        { status: 409 }
      );
    }

    const { error } = await db
      .from("tasks")
      .update({ claimed_by_session: sessionId, status: "claimed" })
      .eq("id", taskId);

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, type: "task_claim", session_id: sessionId, task_id: taskId });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
