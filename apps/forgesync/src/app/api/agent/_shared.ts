import { NextResponse } from "next/server";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;

  try {
    parsed = await req.json();
  } catch {
    throw new ValidationError("Expected a valid JSON request body.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Request body must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Field '${key}' must be a non-empty string.`);
  }

  return value;
}

export function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`Field '${key}' must be a string when provided.`);
  }

  return value;
}
