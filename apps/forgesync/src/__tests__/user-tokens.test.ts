import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "./helpers";

const mocks = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockCreateApiToken: vi.fn(),
  mockResolveScopes: vi.fn(),
  mockResolveExpiration: vi.fn(),
  tokenRows: [
    {
      id: "tok-1",
      project_id: "proj-1",
      name: "default",
      created_at: "2026-03-28T00:00:00.000Z",
      expires_at: null,
      scopes: ["agent:read", "agent:write"],
      last_used_at: null,
    },
  ],
}));

vi.mock("@/lib/session-user", () => ({
  getSessionUser: mocks.mockGetSessionUser,
}));

vi.mock("@/lib/api-tokens", () => ({
  createApiToken: mocks.mockCreateApiToken,
  resolveScopes: mocks.mockResolveScopes,
  resolveExpiration: mocks.mockResolveExpiration,
}));

vi.mock("../app/api/agent/_supabase", () => {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: mocks.tokenRows, error: null }),
  };
  chain.then = (resolve: (value: { error: null }) => unknown) =>
    Promise.resolve({ error: null }).then(resolve);
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

import { DELETE, GET, POST } from "../app/api/user/tokens/route";

describe("user token routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetSessionUser.mockResolvedValue({ id: "user-1" });
    mocks.mockResolveScopes.mockReturnValue(["agent:read", "agent:write"]);
    mocks.mockResolveExpiration.mockReturnValue(null);
    mocks.mockCreateApiToken.mockResolvedValue({
      token: "fsk_plaintext",
      record: mocks.tokenRows[0],
    });
  });

  it("lists tokens without returning plaintext secrets", async () => {
    const { status, body } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(body.tokens).toEqual(mocks.tokenRows);
    expect(JSON.stringify(body)).not.toContain("fsk_plaintext");
  });

  it("creates a new scoped token", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: "proj-1", name: "ci-token", scopes: ["agent:read"] }),
    });

    const { status, body } = await parseResponse(await POST(request));

    expect(status).toBe(201);
    expect(body.token).toBe("fsk_plaintext");
    expect(mocks.mockCreateApiToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        projectId: "proj-1",
        name: "ci-token",
      })
    );
  });

  it("revokes an owned token", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/tokens", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "tok-1" }),
    });

    const { status, body } = await parseResponse(await DELETE(request));

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
