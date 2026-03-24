import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalFetch = globalThis.fetch;

describe("generateSummary", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    globalThis.fetch = originalFetch;
  });

  it("returns AI-generated summary text", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: "This is a summary of the content." }] } }],
      }),
    });

    const { generateSummary } = await import("../app/api/agent/_summarize");
    const result = await generateSummary("some content", "artifact", "my title");

    expect(result).toBe("This is a summary of the content.");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const { generateSummary } = await import("../app/api/agent/_summarize");
    await expect(generateSummary("content", "artifact", "title")).rejects.toThrow("Missing GEMINI_API_KEY");
  });

  it("throws on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const { generateSummary } = await import("../app/api/agent/_summarize");
    await expect(generateSummary("content", "artifact", "title")).rejects.toThrow("Gemini summarization failed");
  });
});
