import { NextResponse } from "next/server";
import { getSupabase } from "../_supabase";
import { ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString, logger, logAudit, extractClientIp, extractTokenHint } from "../_shared";

const DEFAULT_TTL_MIN = 30;

export async function POST(req: Request) {
  const start = Date.now();
  const ip = extractClientIp(req);
  const tokenHint = extractTokenHint(req);

  try {
    await requireAgentAuth(req);
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
      if (!holder) {
        return badRequest("Lock holder could not be resolved.");
      }
      if (holder.session_id !== sessionId) {
        logger.warn("lock conflict", { resource, session_id: sessionId, held_by: holder.session_id, project_id: projectId });
        logAudit({ action: "lock.acquire", session_id: sessionId, project_id: projectId, resource, ip, token_hint: tokenHint, status: "failure", error: `locked by session ${holder.session_id}`, duration_ms: Date.now() - start });
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
      logAudit({ action: "lock.acquire", session_id: sessionId, project_id: projectId, resource, ip, token_hint: tokenHint, status: "failure", error: error.message, duration_ms: Date.now() - start });
      return badRequest(`DB error: ${error.message}`);
    }

    logger.info("lock acquired", { session_id: sessionId, resource, project_id: projectId, ttl_min: DEFAULT_TTL_MIN });
    logAudit({ action: "lock.acquire", session_id: sessionId, project_id: projectId, resource, ip, token_hint: tokenHint, status: "success", duration_ms: Date.now() - start });

    return ok({ ok: true, type: "lock", session_id: sessionId, resource, ttl_min: DEFAULT_TTL_MIN });
  } catch (error) {
    logAudit({ action: "lock.acquire", ip, token_hint: tokenHint, status: "failure", error: (error as Error).message, duration_ms: Date.now() - start });

    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
