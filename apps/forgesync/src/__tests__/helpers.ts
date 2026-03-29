import { vi } from "vitest";

/** Shared test token — must match FORGESYNC_AGENT_API_TOKEN env var set in tests */
export const TEST_TOKEN = "test-secret-token";

/** Default auth headers used by all mock request helpers */
const authHeaders = (): Record<string, string> => ({
  "x-forgesync-token": TEST_TOKEN,
});

/**
 * Build a mock Request with JSON body for testing POST route handlers.
 */
export function mockPostRequest(body: unknown, headers?: Record<string, string>): Request {
  const h = new Headers({ "content-type": "application/json", ...authHeaders(), ...headers });
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

/**
 * Build a mock GET Request with query params for testing GET route handlers.
 */
export function mockGetRequest(path: string, params?: Record<string, string>, headers?: Record<string, string>): Request {
  const url = new URL(path, "http://localhost:3000");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const h = new Headers({ ...authHeaders(), ...(headers || {}) });
  return new Request(url.toString(), { method: "GET", headers: h });
}

/**
 * Build a mock PUT Request with JSON body.
 */
export function mockPutRequest(body: unknown, headers?: Record<string, string>): Request {
  const h = new Headers({ "content-type": "application/json", ...authHeaders(), ...headers });
  return new Request("http://localhost:3000/api/test", {
    method: "PUT",
    headers: h,
    body: JSON.stringify(body),
  });
}

/**
 * Extract JSON from a NextResponse.
 */
export async function parseResponse(response: Response): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = await response.json();
  return { status: response.status, body };
}

/**
 * Create a chainable mock Supabase client.
 * Each method returns `this` for chaining, except terminal methods (single, etc.).
 */
export function createMockSupabase(overrides?: {
  selectData?: unknown;
  insertData?: unknown;
  rpcData?: unknown;
  error?: { message: string } | null;
}) {
  const opts = { selectData: null, insertData: null, rpcData: null, error: null, ...overrides };

  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: opts.insertData || opts.selectData, error: opts.error }),
    rpc: vi.fn().mockResolvedValue({ data: opts.rpcData || [], error: opts.error }),
  };

  // Make terminal-ish calls also resolve
  chain.from.mockReturnValue(chain);

  return chain;
}
