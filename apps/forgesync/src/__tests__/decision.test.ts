import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "dec-1" }, error: null }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

vi.mock("../app/api/agent/_embeddings", () => ({
  enqueueEmbedding: vi.fn().mockResolvedValue(undefined),
  enqueueSummarize: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../app/api/agent/decision/route";

describe("POST /api/agent/decision", () => {
  beforeEach(() => {
    delete process.env.FORGESYNC_AGENT_API_TOKEN;
  });

  it("returns 200 and enqueues embedding", async () => {
    const req = mockPostRequest({ session_id: "s1", decision: "Use bcrypt" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.type).toBe("decision");
    expect(body.id).toBe("dec-1");
    expect(body.decision).toBe("Use bcrypt");
  });

  it("returns 400 for missing decision", async () => {
    const req = mockPostRequest({ session_id: "s1" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 400 for missing session_id", async () => {
    const req = mockPostRequest({ decision: "something" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
  });
});
