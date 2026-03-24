import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  // Need to support: .from().update().eq().eq() → resolves
  const terminalEq = vi.fn().mockResolvedValue({ error: null });
  const firstEq = vi.fn().mockReturnValue({ eq: terminalEq });
  const chain = {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({ eq: firstEq }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

import { POST } from "../app/api/agent/session/end/route";

describe("POST /api/agent/session/end", () => {
  beforeEach(() => {
    delete process.env.FORGESYNC_AGENT_API_TOKEN;
  });

  it("returns 200 with ended=true", async () => {
    const req = mockPostRequest({ session_id: "abc-123" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.ended).toBe(true);
    expect(body.session_id).toBe("abc-123");
  });

  it("returns 400 for missing session_id", async () => {
    const req = mockPostRequest({});
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
