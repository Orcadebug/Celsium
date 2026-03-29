import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/app/api/agent/_supabase";
import { validateCliCallbackUrl } from "@/lib/cli-link";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const callbackUrl = typeof body.callback_url === "string" ? body.callback_url : "";
  const requestedProjectId = typeof body.project_id === "string" ? body.project_id.trim() : null;

  try {
    validateCliCallbackUrl(callbackUrl);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const state = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const db = getSupabase();

  const { error } = await db.from("cli_link_sessions").insert({
    state,
    callback_url: callbackUrl,
    requested_project_id: requestedProjectId,
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const authUrl = new URL("/dashboard/cli-link", origin);
  authUrl.searchParams.set("state", state);

  return NextResponse.json({
    state,
    auth_url: authUrl.toString(),
    expires_at: expiresAt,
  });
}
