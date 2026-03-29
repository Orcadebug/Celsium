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

  const { data, error } = await db
    .from("projects")
    .select("id, name, repo_url, created_at")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ project: data });
}
