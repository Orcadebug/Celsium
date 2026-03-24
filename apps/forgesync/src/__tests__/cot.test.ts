import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, mockGetRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "cot-1" }, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: [{ id: "cot-1", conclusion: "Use bcrypt", similarity: 0.9 }], error: null }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

vi.mock("../app/api/agent/_embeddings", () => ({
  enqueueEmbedding: vi.fn().mockResolvedValue(undefined),
  enqueueSummarize: vi.fn().mockResolvedValue(undefined),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0)),
}));

import { POST } from "../app/api/agent/cot/route";
import { GET } from "../app/api/agent/cot/query/route";

describe("POST /api/agent/cot", () => {
  beforeEach(() => {
    delete process.env.FORGESYNC_AGENT_API_TOKEN;
  });

  it("returns 200 with CoT saved", async () => {
    const req = mockPostRequest({
      session_id: "s1",
      reasoning_steps: [{ step: 1, thought: "Check bcrypt" }],
      conclusion: "Use bcrypt",
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.type).toBe("cot");
    expect(body.id).toBe("cot-1");
  });

  it("returns 400 for missing reasoning_steps", async () => {
    const req = mockPostRequest({ session_id: "s1" });
    const { status } = await parseResponse(await POST(req));
    expect(status).toBe(400);
  });

  it("returns 400 for non-array reasoning_steps", async () => {
    const req = mockPostRequest({ session_id: "s1", reasoning_steps: "not an array" });
    const { status } = await parseResponse(await POST(req));
    expect(status).toBe(400);
  });
});

describe("GET /api/agent/cot/query", () => {
  beforeEach(() => {
    delete process.env.FORGESYNC_AGENT_API_TOKEN;
  });

  it("returns search results", async () => {
    const req = mockGetRequest("/api/agent/cot/query", { q: "bcrypt" });
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("returns 400 without q parameter", async () => {
    const req = mockGetRequest("/api/agent/cot/query");
    const { status } = await parseResponse(await GET(req));
    expect(status).toBe(400);
  });
});
