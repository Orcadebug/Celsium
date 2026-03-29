import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

import { POST } from "../app/api/agent/project/init/route";

describe("POST /api/agent/project/init", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  it("returns 200 with project linked", async () => {
    const req = mockPostRequest({
      projectId: "p1",
      repositoryRoot: "/home/user/project",
      createdAt: "2026-01-01T00:00:00Z",
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.linked).toBe(true);
    expect(body.project_id).toBe("p1");
  });

  it("returns 400 for missing required fields", async () => {
    const req = mockPostRequest({ projectId: "p1" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
