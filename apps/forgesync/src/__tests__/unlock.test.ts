import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  // Need: .from().delete().eq().eq() → resolves
  const terminalEq = vi.fn().mockResolvedValue({ error: null, count: 1 });
  const firstEq = vi.fn().mockReturnValue({ eq: terminalEq });
  const chain = {
    from: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnValue({ eq: firstEq }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

import { POST } from "../app/api/agent/unlock/route";

describe("POST /api/agent/unlock", () => {
  beforeEach(() => {
    delete process.env.FORGESYNC_AGENT_API_TOKEN;
  });

  it("returns 200 on successful unlock", async () => {
    const req = mockPostRequest({ session_id: "s1", resource: "src/api/auth/" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.type).toBe("unlock");
  });

  it("returns 400 for missing fields", async () => {
    const req = mockPostRequest({ session_id: "s1" });
    const { status } = await parseResponse(await POST(req));
    expect(status).toBe(400);
  });
});
