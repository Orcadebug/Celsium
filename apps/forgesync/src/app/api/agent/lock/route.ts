import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ ok: true, type: "lock", ttl_min: 30, received: body });
}