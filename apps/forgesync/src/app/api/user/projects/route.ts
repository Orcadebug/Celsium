import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/app/api/agent/_supabase";
import { getSessionUser } from "@/lib/session-user";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("projects")
    .select("id, name, repo_url, created_at, user_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data || [] });
}

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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const repoUrl = typeof body.repo_url === "string" ? body.repo_url.trim() : null;

  const db = getSupabase();
  const { data, error } = await db
    .from("projects")
    .insert({
      name,
      repo_url: repoUrl,
      user_id: user.id,
    })
    .select("id, name, repo_url, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data }, { status: 201 });
}
