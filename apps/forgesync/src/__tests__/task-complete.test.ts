import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  // Need: .from().update().eq().eq() → resolves
  const terminalEq = vi.fn().mockResolvedValue({ error: null });
  const firstEq = vi.fn().mockReturnValue({ eq: terminalEq });
  const chain = {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({ eq: firstEq }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

import { POST } from "../app/api/agent/task/complete/route";

describe("POST /api/agent/task/complete", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  it("returns 200 on completion", async () => {
    const req = mockPostRequest({ session_id: "s1", task_id: "t1" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.type).toBe("task_complete");
  });

  it("returns 400 for missing fields", async () => {
    const req = mockPostRequest({ session_id: "s1" });
    const { status } = await parseResponse(await POST(req));
    expect(status).toBe(400);
  });
});
