import { NextResponse } from "next/server";
import { getSupabase } from "../_supabase";
import { ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString } from "../_shared";

const DEFAULT_TTL_MIN = 30;

export async function POST(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const resource = requireString(body, "resource");
    const projectId = optionalString(body, "project_id");

    const db = getSupabase();

    // Check for existing lock on this resource
    const now = new Date().toISOString();
    let conflictQuery = db
      .from("file_locks")
      .select("id, session_id, expires_at")
      .eq("path", resource)
      .gt("expires_at", now);

    if (projectId) {
      conflictQuery = conflictQuery.eq("project_id", projectId);
    }

    const { data: existing } = await conflictQuery;

    if (existing && existing.length > 0) {
      const holder = existing[0];
      if (holder.session_id !== sessionId) {
        return NextResponse.json(
          { ok: false, error: `Resource '${resource}' is locked by session ${holder.session_id}` },
          { status: 409 }
        );
      }
      // Same session already holds the lock — extend it
    }

    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MIN * 60 * 1000).toISOString();

    const { error } = await db.from("file_locks").upsert(
      {
        project_id: projectId || null,
        session_id: sessionId,
        path: resource,
        expires_at: expiresAt,
      },
      { onConflict: "id" }
    );

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, type: "lock", session_id: sessionId, resource, ttl_min: DEFAULT_TTL_MIN });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
