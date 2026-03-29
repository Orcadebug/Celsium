import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockGetRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({
      data: [
        { id: "k-1", kind: "memory", title: "JWT auth", content: "Use JWT", summary: "Auth decision", similarity: 0.85 },
      ],
      error: null,
    }),
  };
  return { getSupabase: () => chain };
});

vi.mock("../app/api/agent/_embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
}));

import { GET } from "../app/api/agent/knowledge/query/route";

describe("GET /api/agent/knowledge/query", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  it("returns 200 with search results", async () => {
    const req = mockGetRequest("/api/agent/knowledge/query", { q: "auth" });
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(1);
  });

  it("passes kinds filter to RPC", async () => {
    const req = mockGetRequest("/api/agent/knowledge/query", { q: "auth", kinds: "memory,decision" });
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.query as Record<string, unknown>).kinds).toEqual(["memory", "decision"]);
  });

  it("returns 400 when q is missing", async () => {
    const req = mockGetRequest("/api/agent/knowledge/query", {});
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
