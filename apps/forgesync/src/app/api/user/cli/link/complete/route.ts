import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/app/api/agent/_supabase";
import { createApiToken } from "@/lib/api-tokens";
import { buildCliCallbackUrl } from "@/lib/cli-link";
import { getSessionUser } from "@/lib/session-user";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const state = typeof body.state === "string" ? body.state.trim() : "";
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";

  if (!state || !projectId) {
    return NextResponse.json({ error: "state and project_id are required" }, { status: 400 });
  }

  const db = getSupabase();
  const { data: linkSession, error: linkError } = await db
    .from("cli_link_sessions")
    .select("id, callback_url, expires_at, completed_at")
    .eq("state", state)
    .single();

  if (linkError || !linkSession) {
    return NextResponse.json({ error: "Link session not found" }, { status: 404 });
  }

  if (linkSession.completed_at) {
    return NextResponse.json({ error: "Link session already completed" }, { status: 409 });
  }

  if (new Date(linkSession.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link session expired" }, { status: 410 });
  }

  const { data: project, error: projectError } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const { token, record } = await createApiToken({
      userId: user.id,
      projectId,
      name: "cli-link",
      scopes: ["agent:read", "agent:write"],
    });

    const { error: updateError } = await db
      .from("cli_link_sessions")
      .update({
        user_id: user.id,
        project_id: projectId,
        token_id: record.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", linkSession.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      redirect_url: buildCliCallbackUrl(linkSession.callback_url, {
        state,
        token,
        projectId,
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
