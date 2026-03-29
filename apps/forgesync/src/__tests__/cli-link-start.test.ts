import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "./helpers";

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

import { POST } from "../app/api/cli/link/start/route";

describe("POST /api/cli/link/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a localhost login URL for valid callbacks", async () => {
    const req = new NextRequest("http://localhost:3000/api/cli/link/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_url: "http://127.0.0.1:45454/callback" }),
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(200);
    expect(typeof body.state).toBe("string");
    expect(typeof body.auth_url).toBe("string");
  });

  it("rejects non-localhost callbacks", async () => {
    const req = new NextRequest("http://localhost:3000/api/cli/link/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_url: "https://example.com/callback" }),
    });
    const { status, body } = await parseResponse(await POST(req));

    expect(status).toBe(400);
    expect(body.error).toContain("localhost");
  });
});
