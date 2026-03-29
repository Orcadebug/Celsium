import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/app/api/agent/_supabase";
import { getSessionUser } from "@/lib/session-user";

type Params = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_req: NextRequest, context: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const db = getSupabase();

  const { data: project, error: projectError } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data, error } = await db
    .from("sessions")
    .select("id, agent_id, agent_name, intent, status, started_at")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data || [] });
}
