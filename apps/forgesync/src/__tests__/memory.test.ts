import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "mem-1" }, error: null }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

vi.mock("../app/api/agent/_embeddings", () => ({
  enqueueEmbedding: vi.fn().mockResolvedValue(undefined),
  enqueueSummarize: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../app/api/agent/memory/route";

describe("POST /api/agent/memory", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  it("returns 200 with saved=true", async () => {
    const req = mockPostRequest({ session_id: "s1", content: "Auth uses JWT" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.saved).toBe(true);
    expect(body.id).toBe("mem-1");
  });

  it("returns 400 for missing content", async () => {
    const req = mockPostRequest({ session_id: "s1" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
