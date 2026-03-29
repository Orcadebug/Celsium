import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

const mockChain = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
};

// Default: no existing locks, upsert succeeds
mockChain.gt.mockResolvedValue({ data: [], error: null });
mockChain.upsert.mockResolvedValue({ error: null });
mockChain.from.mockReturnValue(mockChain);

vi.mock("../app/api/agent/_supabase", () => ({
  getSupabase: () => mockChain,
}));

import { POST } from "../app/api/agent/lock/route";

describe("POST /api/agent/lock", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
    mockChain.gt.mockResolvedValue({ data: [], error: null });
    mockChain.upsert.mockResolvedValue({ error: null });
  });

  it("returns 200 when lock acquired", async () => {
    const req = mockPostRequest({ session_id: "s1", resource: "src/api/auth/" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.type).toBe("lock");
    expect(body.resource).toBe("src/api/auth/");
    expect(body.ttl_min).toBe(30);
  });

  it("returns 409 when resource already locked by another session", async () => {
    mockChain.gt.mockResolvedValue({
      data: [{ id: "lock-1", session_id: "other-session", expires_at: "2099-01-01" }],
      error: null,
    });

    const req = mockPostRequest({ session_id: "s1", resource: "src/api/auth/" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("locked");
  });

  it("returns 400 for missing resource", async () => {
    const req = mockPostRequest({ session_id: "s1" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
  });
});
