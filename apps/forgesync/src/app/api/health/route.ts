// GET /api/health
// Returns 200 if healthy, 503 if unhealthy.
// No auth required — designed for load balancer probes.

import { NextResponse } from "next/server";
import { getSupabase } from "../agent/_supabase";

export async function GET() {
  const timestamp = new Date().toISOString();
  const checks: Record<string, string> = {};

  try {
    const db = getSupabase();
    const { error } = await db.from("projects").select("id").limit(1);

    if (error) {
      throw new Error(error.message);
    }

    checks.database = "ok";
  } catch (err) {
    checks.database = `error: ${(err as Error).message}`;
    return NextResponse.json(
      { status: "unhealthy", timestamp, checks },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { status: "healthy", timestamp, checks },
    { status: 200 }
  );
}
