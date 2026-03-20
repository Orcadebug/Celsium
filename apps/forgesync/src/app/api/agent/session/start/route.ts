import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    session_id: crypto.randomUUID(),
    received: body,
    context: {
      recent_decisions: [],
      relevant_memory: [],
      active_sessions: [],
      locked_files: [],
      open_tasks: [],
      constraints: [],
      patterns: []
    }
  });
}