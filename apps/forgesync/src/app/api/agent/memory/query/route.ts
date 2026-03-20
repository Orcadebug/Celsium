import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return NextResponse.json({ ok: true, query: Object.fromEntries(searchParams), results: [] });
}