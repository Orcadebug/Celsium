import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "./helpers";

const mocks = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockCreateApiToken: vi.fn(),
  state: {
    linkSession: {
      id: "link-1",
      callback_url: "http://127.0.0.1:45454/callback",
      expires_at: "2099-01-01T00:00:00.000Z",
      completed_at: null as string | null,
    },
    projectRecord: { id: "proj-1" } as { id: string } | null,
  },
}));

vi.mock("@/lib/session-user", () => ({
  getSessionUser: mocks.mockGetSessionUser,
}));

vi.mock("@/lib/api-tokens", () => ({
  createApiToken: mocks.mockCreateApiToken,
}));

vi.mock("../app/api/agent/_supabase", () => {
  let currentTable = "";
  const chain: any = {
    from: vi.fn().mockImplementation((table: string) => {
      currentTable = table;
      return chain;
    }),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(async () => {
      if (currentTable === "cli_link_sessions") {
        return { data: mocks.state.linkSession, error: mocks.state.linkSession ? null : { message: "Not found" } };
      }
      if (currentTable === "projects") {
        return { data: mocks.state.projectRecord, error: mocks.state.projectRecord ? null : { message: "Not found" } };
      }
      return { data: null, error: { message: "Unexpected table" } };
    }),
  };
  chain.then = (resolve: (value: { error: null }) => unknown) =>
    Promise.resolve({ error: null }).then(resolve);
  return { getSupabase: () => chain };
});

import { POST } from "../app/api/user/cli/link/complete/route";

describe("POST /api/user/cli/link/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetSessionUser.mockResolvedValue({ id: "user-1" });
    mocks.mockCreateApiToken.mockResolvedValue({
      token: "fsk_plaintext",
      record: { id: "token-1" },
    });
    mocks.state.linkSession = {
      id: "link-1",
      callback_url: "http://127.0.0.1:45454/callback",
      expires_at: "2099-01-01T00:00:00.000Z",
      completed_at: null,
    };
    mocks.state.projectRecord = { id: "proj-1" };
  });

  it("completes the browser handoff and returns a localhost callback URL", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/cli/link/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "state-1", project_id: "proj-1" }),
    });

    const { status, body } = await parseResponse(await POST(request));

    expect(status).toBe(200);
    expect(String(body.redirect_url)).toContain("127.0.0.1:45454/callback");
    expect(String(body.redirect_url)).toContain("project_id=proj-1");
  });

  it("rejects expired link sessions", async () => {
    mocks.state.linkSession.expires_at = "2000-01-01T00:00:00.000Z";

    const request = new NextRequest("http://localhost:3000/api/user/cli/link/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "state-1", project_id: "proj-1" }),
    });

    const { status, body } = await parseResponse(await POST(request));

    expect(status).toBe(410);
    expect(body.error).toContain("expired");
  });
});
