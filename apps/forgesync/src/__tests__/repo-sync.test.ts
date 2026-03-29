import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPostRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  let currentTable = "";
  const chain = {
    from: vi.fn().mockImplementation((table: string) => {
      currentTable = table;
      return chain;
    }),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(async () => {
      if (currentTable === "sessions") {
        return { data: { id: "session-1", project_id: "proj-1" }, error: null };
      }
      return { data: { id: "file-1" }, error: null };
    }),
  };
  return { getSupabase: () => chain };
});

vi.mock("../app/api/agent/_embeddings", () => ({
  enqueueSummarize: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../app/api/agent/repo/sync/route";

describe("POST /api/agent/repo/sync", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  it("syncs changed files into knowledge entries", async () => {
    const req = mockPostRequest({
      project_id: "proj-1",
      session_id: "session-1",
      files: [
        {
          path: "src/index.ts",
          title: "src/index.ts",
          content: "export const hi = true;",
          content_hash: "hash-1",
          file_type: "code",
          chunk_index: 0,
          chunk_count: 1,
          tags: ["file", "code", "ts"],
        },
      ],
      deleted_paths: [],
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.inserted_chunks).toBe(1);
  });

  it("rejects malformed sync files", async () => {
    const req = mockPostRequest({
      project_id: "proj-1",
      session_id: "session-1",
      files: [{ path: "src/index.ts" }],
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.error).toContain("files");
  });
});
