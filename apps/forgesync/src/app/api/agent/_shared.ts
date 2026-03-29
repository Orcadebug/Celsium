import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabase } from "./_supabase";
import {
  checkRateLimit,
  API_RATE_LIMIT,
  type RateLimitConfig,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { logAudit, type AuditEvent } from "@/lib/audit";

export { logger, logAudit, type AuditEvent };

export function extractClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return (forwarded.split(",")[0] ?? forwarded).trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function extractTokenHint(req: Request): string | undefined {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const token = bearer || req.headers.get("x-forgesync-token")?.trim() || "";
  return token ? token.slice(0, 8) : undefined;
}

/**
 * Wraps a route handler with audit logging. Logs action, identifiers,
 * status, and duration as structured JSON.
 */
export function withAudit(
  action: string,
  handler: (req: Request) => Promise<{ response: Response; auditFields?: Partial<AuditEvent> }>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const start = Date.now();
    const ip = extractClientIp(req);
    const tokenHint = extractTokenHint(req);

    try {
      const { response, auditFields } = await handler(req);
      const duration_ms = Date.now() - start;
      const status = response.ok ? "success" : "failure";

      logAudit({
        action,
        ip,
        token_hint: tokenHint,
        status,
        duration_ms,
        ...auditFields,
      });

      return response;
    } catch (error) {
      const duration_ms = Date.now() - start;

      logAudit({
        action,
        ip,
        token_hint: tokenHint,
        status: "failure",
        error: (error as Error).message,
        duration_ms,
      });

      throw error;
    }
  };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends Error {
  public readonly response: Response;
  constructor(response: Response) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
    this.response = response;
  }
}

export type AgentAuthContext = {
  tokenId?: string;
  userId?: string;
  projectId?: string;
  scopes?: string[];
};

function recordUsageEvent(input: {
  tokenId?: string;
  userId?: string;
  projectId?: string;
  route: string;
  method: string;
  ip: string;
}) {
  if (!input.tokenId || !input.userId) {
    return;
  }

  const db = getSupabase();
  db.from("usage_events")
    .insert({
      token_id: input.tokenId,
      user_id: input.userId,
      project_id: input.projectId ?? null,
      route: input.route,
      method: input.method,
      ip: input.ip,
      status: "success",
    })
    .then(
      () => {},
      () => {}
    );
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

function extractToken(req: Request): string {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  return bearer || req.headers.get("x-forgesync-token")?.trim() || "";
}

function extractIdentifier(req: Request): string {
  const token = extractToken(req);
  if (token) return `token:${token}`;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return `ip:${(forwarded.split(",")[0] ?? forwarded).trim()}`;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp.trim()}`;
  return "ip:unknown";
}

/**
 * Check rate limit for the request. Returns a 429 Response if the limit is
 * exceeded, or null if the request is allowed. When allowed, the result
 * headers are attached to the returned null so callers can optionally
 * forward them — but the primary integration point is inside
 * `requireAgentAuth` which throws on limit exceeded.
 */
export function applyRateLimit(
  req: Request,
  config: RateLimitConfig = API_RATE_LIMIT
): Response | null {
  const identifier = extractIdentifier(req);
  const result: RateLimitResult = checkRateLimit(identifier, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetAt),
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  return null;
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export async function requireAgentAuth(req: Request): Promise<AgentAuthContext> {
  // Rate-limit before any auth work
  const rateLimitResponse = applyRateLimit(req);
  if (rateLimitResponse) {
    throw new RateLimitError(rateLimitResponse);
  }

  const token = extractToken(req);

  // Fast path: env var token for local dev / single-instance mode
  const configuredToken = process.env.FORGESYNC_AGENT_API_TOKEN;
  if (configuredToken) {
    if (!token) throw new ValidationError("Unauthorized agent request.");
    if (token === configuredToken) return {};
    // Token didn't match env var — fall through to DB lookup
  }

  // No token and no env var configured — reject (auth is mandatory)
  if (!token && !configuredToken) {
    throw new ValidationError("Authentication required. Set FORGESYNC_AGENT_API_TOKEN or provide a valid API token.");
  }

  // DB lookup: hash the token and check api_tokens table
  const db = getSupabase();
  const tokenHash = hashToken(token);
  const { data, error } = await db
    .from("api_tokens")
    .select("id, user_id, project_id, expires_at, scopes")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !data) {
    throw new ValidationError("Unauthorized agent request.");
  }

  // Check token expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new ValidationError("Token expired");
  }

  // Update last_used_at (fire-and-forget)
  db.from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .then(() => {});

  recordUsageEvent({
    tokenId: data.id,
    userId: data.user_id,
    projectId: data.project_id,
    route: new URL(req.url).pathname,
    method: req.method,
    ip: extractClientIp(req),
  });

  return {
    tokenId: data.id,
    userId: data.user_id,
    projectId: data.project_id,
    scopes: data.scopes ?? ["agent:read", "agent:write"],
  };
}

export function requireScope(auth: AgentAuthContext, scope: string): void {
  if (!auth.scopes) return; // env-var token has full access
  if (auth.scopes.includes("*")) return;
  if (!auth.scopes.includes(scope)) {
    throw new ValidationError(`Token missing required scope: ${scope}`);
  }
}
