import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../agent/_supabase";
import { createApiToken, resolveExpiration, resolveScopes } from "@/lib/api-tokens";
import { getSessionUser } from "@/lib/session-user";

// GET /api/user/tokens — list current user's tokens (hides the actual token values)
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("api_tokens")
    .select("id, project_id, name, created_at, expires_at, scopes, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tokens: data });
}

// POST /api/user/tokens — create a new token
// Body: { project_id: string, name?: string }
// Returns the plaintext token ONCE — it is never stored
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

  const projectId = body.project_id;
  if (typeof projectId !== "string" || !projectId.trim()) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "default";
  let scopes: string[];
  try {
    scopes = resolveScopes(body.scopes);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  try {
    const { token, record } = await createApiToken({
      userId: user.id,
      projectId: projectId.trim(),
      name,
      scopes,
      expiresAt: resolveExpiration(body.expires_in_days),
    });

    return NextResponse.json({ token, ...record }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// DELETE /api/user/tokens — revoke a token
// Body: { id: string }
export async function DELETE(req: NextRequest) {
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

  const tokenId = body.id;
  if (typeof tokenId !== "string" || !tokenId.trim()) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const db = getSupabase();
  const { error } = await db
    .from("api_tokens")
    .delete()
    .eq("id", tokenId.trim())
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
