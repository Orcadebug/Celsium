import { createHash, randomBytes } from "node:crypto";
import { getSupabase } from "@/app/api/agent/_supabase";

const VALID_SCOPES = [
  "*",
  "agent:read",
  "agent:write",
  "session",
  "memory",
  "knowledge",
  "task",
  "lock",
  "decision",
  "project",
  "read",
] as const;

export function resolveScopes(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return ["agent:read", "agent:write"];
  }

  const requested = input.filter((value): value is string => typeof value === "string");
  const invalid = requested.filter((scope) => !VALID_SCOPES.includes(scope as (typeof VALID_SCOPES)[number]));
  if (invalid.length > 0) {
    throw new Error(`Invalid scopes: ${invalid.join(", ")}`);
  }

  return requested.length > 0 ? requested : ["agent:read", "agent:write"];
}

export function resolveExpiration(expiresInDays: unknown): string | null {
  if (typeof expiresInDays !== "number" || expiresInDays <= 0) {
    return null;
  }

  const date = new Date();
  date.setDate(date.getDate() + expiresInDays);
  return date.toISOString();
}

export async function createApiToken(params: {
  userId: string;
  projectId: string;
  name?: string;
  scopes?: string[];
  expiresAt?: string | null;
}) {
  const rawToken = randomBytes(32).toString("hex");
  const plaintext = `fsk_${rawToken}`;
  const tokenHash = createHash("sha256").update(plaintext).digest("hex");

  const db = getSupabase();
  const { data, error } = await db
    .from("api_tokens")
    .insert({
      user_id: params.userId,
      project_id: params.projectId,
      token_hash: tokenHash,
      name: params.name || "default",
      expires_at: params.expiresAt ?? null,
      scopes: params.scopes ?? ["agent:read", "agent:write"],
    })
    .select("id, project_id, name, created_at, expires_at, scopes, last_used_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { token: plaintext, record: data };
}
