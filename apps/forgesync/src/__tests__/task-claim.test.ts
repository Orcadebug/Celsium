import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

const mockChain = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: "t1", status: "open", claimed_by_session: null }, error: null }),
};
mockChain.from.mockReturnValue(mockChain);
mockChain.eq.mockReturnThis();

vi.mock("../app/api/agent/_supabase", () => ({
  getSupabase: () => mockChain,
}));

import { POST } from "../app/api/agent/task/claim/route";

describe("POST /api/agent/task/claim", () => {
  beforeEach(() => {
    delete process.env.FORGESYNC_AGENT_API_TOKEN;
    mockChain.single.mockResolvedValue({ data: { id: "t1", status: "open", claimed_by_session: null }, error: null });
    mockChain.eq.mockReturnThis();
    // Make the update chain resolve
    mockChain.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it("returns 200 when task claimed", async () => {
    const req = mockPostRequest({ session_id: "s1", task_id: "t1" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.type).toBe("task_claim");
  });

  it("returns 400 for missing task_id", async () => {
    const req = mockPostRequest({ session_id: "s1" });
    const { status } = await parseResponse(await POST(req));
    expect(status).toBe(400);
  });
});
