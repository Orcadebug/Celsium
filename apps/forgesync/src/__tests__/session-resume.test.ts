import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockGetRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const sessionData = {
    id: "s-1",
    agent_id: "claude",
    intent: "fix bug",
    status: "ended",
    started_at: "2026-01-01",
    ended_at: "2026-01-01",
  };

  const knowledgeData = [
    { id: "k-1", kind: "memory", title: "test", content: "content", summary: "summary", metadata: {}, tags: [], created_at: "2026-01-01" },
  ];

  const makeChain = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const self = () => chain;
    chain.from = vi.fn().mockImplementation(() => self());
    chain.select = vi.fn().mockImplementation(() => self());
    chain.eq = vi.fn().mockImplementation(() => self());
    chain.gt = vi.fn().mockImplementation(() => self());
    chain.order = vi.fn().mockImplementation(() => self());
    chain.limit = vi.fn().mockImplementation(() => self());
    chain.single = vi.fn().mockResolvedValue({ data: sessionData, error: null });
    // Make the chain itself thenable for non-single queries
    chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
      return Promise.resolve({ data: knowledgeData, error: null }).then(resolve);
    });
    return chain;
  };

  return { getSupabase: () => makeChain() };
});

import { GET } from "../app/api/agent/session/resume/route";

describe("GET /api/agent/session/resume", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  it("returns 200 with session snapshot by session_id", async () => {
    const req = mockGetRequest("/api/agent/session/resume", { session_id: "s-1" });
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.session).toBeDefined();
  });

  it("returns 400 when neither session_id nor agent_id provided", async () => {
    const req = mockGetRequest("/api/agent/session/resume", {});
    const { status, body } = await parseResponse(await GET(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
