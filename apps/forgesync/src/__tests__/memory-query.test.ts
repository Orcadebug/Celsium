import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockGetRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [{ id: "m1", title: "Auth", content: "JWT tokens", type: "general", tags: [] }],
      error: null,
    }),
    rpc: vi.fn().mockResolvedValue({
      data: [{ id: "m1", title: "Auth", content: "JWT tokens", type: "general", tags: [], similarity: 0.9 }],
      error: null,
    }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

vi.mock("../app/api/agent/_embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0)),
}));

import { GET } from "../app/api/agent/memory/query/route";

describe("GET /api/agent/memory/query", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  it("returns results for text query", async () => {
    const req = mockGetRequest("/api/agent/memory/query", { q: "authentication" });
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("returns results for session_id query", async () => {
    const req = mockGetRequest("/api/agent/memory/query", { session_id: "s1" });
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("returns 400 when neither q nor session_id provided", async () => {
    const req = mockGetRequest("/api/agent/memory/query", {});
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
