import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

// Mock Supabase before importing route
vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "test-session-id" }, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

vi.mock("../app/api/agent/_embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0)),
}));

import { POST } from "../app/api/agent/session/start/route";

describe("POST /api/agent/session/start", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  it("returns 200 with session_id and context", async () => {
    const req = mockPostRequest({ agent_id: "test-agent" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.session_id).toBe("test-session-id");
    expect(body.context).toBeDefined();
    expect(body.context).toHaveProperty("project_dna");
    expect(body.context).toHaveProperty("relevant_knowledge");
    expect(body.context).toHaveProperty("locked_files");
    expect(body.context).toHaveProperty("active_sessions");
    expect(body.context).toHaveProperty("open_tasks");
  });

  it("returns 400 for missing agent_id", async () => {
    const req = mockPostRequest({});
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("agent_id");
  });

  it("accepts optional intent and project_id", async () => {
    const req = mockPostRequest({ agent_id: "test", intent: "fix bug", project_id: "proj-1" });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
