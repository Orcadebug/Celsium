import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockGetRequest, mockPutRequest, parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { dna: { rules: ["TypeScript"] } }, error: null }),
  };
  chain.from.mockReturnValue(chain);
  chain.eq.mockReturnThis();
  // For update chain, make the terminal eq resolve
  return { getSupabase: () => chain };
});

import { GET, PUT } from "../app/api/agent/project/dna/route";

describe("/api/agent/project/dna", () => {
  beforeEach(() => {
    process.env.FORGESYNC_AGENT_API_TOKEN = "test-secret-token";
  });

  describe("GET", () => {
    it("returns project DNA", async () => {
      const req = mockGetRequest("/api/agent/project/dna", { project_id: "p1" });
      const { status, body } = await parseResponse(await GET(req));

      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.dna).toEqual({ rules: ["TypeScript"] });
    });

    it("returns 400 without project_id", async () => {
      const req = mockGetRequest("/api/agent/project/dna");
      const { status } = await parseResponse(await GET(req));
      expect(status).toBe(400);
    });
  });

  describe("PUT", () => {
    it("updates project DNA", async () => {
      const req = mockPutRequest({ project_id: "p1", dna: { rules: ["Go"] } });
      const { status, body } = await parseResponse(await PUT(req));

      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.updated).toBe(true);
    });

    it("returns 400 for invalid dna", async () => {
      const req = mockPutRequest({ project_id: "p1", dna: "not-an-object" });
      const { status } = await parseResponse(await PUT(req));
      expect(status).toBe(400);
    });
  });
});
