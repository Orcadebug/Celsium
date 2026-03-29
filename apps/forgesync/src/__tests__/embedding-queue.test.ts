import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [
        { id: "q1", target_table: "memory_entries", target_id: "m1", text_to_embed: "hello world", attempts: 0 },
      ],
      error: null,
    }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

import { generateEmbedding, enqueueEmbedding, processEmbeddingBatch } from "../app/api/agent/_embeddings";

describe("embedding pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  describe("generateEmbedding()", () => {
    it("calls Gemini API and returns embedding", async () => {
      const fakeEmbedding = new Array(768).fill(0.1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: { values: fakeEmbedding } }),
      });

      const result = await generateEmbedding("hello world");
      expect(result).toEqual(fakeEmbedding);
      expect(result.length).toBe(768);

      const call = mockFetch.mock.calls[0];
      expect(call?.[0]).toContain("gemini-embedding-001");
      const body = JSON.parse(String(call?.[1]?.body));
      expect(body.taskType).toBe("RETRIEVAL_DOCUMENT");
    });

    it("uses RETRIEVAL_QUERY task type when specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: { values: new Array(768).fill(0) } }),
      });

      await generateEmbedding("search query", "RETRIEVAL_QUERY");

      const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
      expect(body.taskType).toBe("RETRIEVAL_QUERY");
    });

    it("throws when GEMINI_API_KEY is missing", async () => {
      delete process.env.GEMINI_API_KEY;
      await expect(generateEmbedding("test")).rejects.toThrow("Missing GEMINI_API_KEY");
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
      });

      await expect(generateEmbedding("test")).rejects.toThrow("Gemini embedding failed");
    });
  });
});
