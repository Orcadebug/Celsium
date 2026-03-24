import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "k-1" }, error: null }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

vi.mock("../app/api/agent/_embeddings", () => ({
  enqueueSummarize: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../app/api/agent/knowledge/route";

describe("POST /api/agent/knowledge", () => {
  beforeEach(() => {
    delete process.env.FORGESYNC_AGENT_API_TOKEN;
  });

  it("returns 200 with summary_pending for artifact", async () => {
    const req = mockPostRequest({
      session_id: "s1",
      kind: "artifact",
      title: "auth middleware",
      content: "export function authMiddleware() { ... }",
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.id).toBe("k-1");
    expect(body.kind).toBe("artifact");
    expect(body.summary_pending).toBe(true);
  });

  it("accepts all valid kinds", async () => {
    for (const kind of ["memory", "decision", "cot", "artifact"]) {
      const req = mockPostRequest({
        session_id: "s1",
        kind,
        title: `test ${kind}`,
        content: "test content",
      });
      const { status, body } = await parseResponse(await POST(req));
      expect(status).toBe(200);
      expect(body.kind).toBe(kind);
    }
  });

  it("returns 400 for invalid kind", async () => {
    const req = mockPostRequest({
      session_id: "s1",
      kind: "invalid",
      title: "test",
      content: "test content",
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 400 for missing title", async () => {
    const req = mockPostRequest({
      session_id: "s1",
      kind: "memory",
      content: "test content",
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 400 for missing content", async () => {
    const req = mockPostRequest({
      session_id: "s1",
      kind: "memory",
      title: "test",
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 400 for missing session_id", async () => {
    const req = mockPostRequest({
      kind: "memory",
      title: "test",
      content: "test content",
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
