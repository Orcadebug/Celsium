import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "./helpers";

const mocks = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  projectRows: [
    { id: "proj-1", name: "Repo One", repo_url: "https://github.com/acme/repo-one", created_at: "2026-03-28T00:00:00.000Z" },
  ],
  insertedProject: {
    id: "proj-2",
    name: "Repo Two",
    repo_url: null,
    created_at: "2026-03-28T01:00:00.000Z",
  },
}));

vi.mock("@/lib/session-user", () => ({
  getSessionUser: mocks.mockGetSessionUser,
}));

vi.mock("../app/api/agent/_supabase", () => {
  let currentTable = "";
  const chain = {
    from: vi.fn().mockImplementation((table: string) => {
      currentTable = table;
      return chain;
    }),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: mocks.projectRows, error: null }),
    single: vi.fn().mockImplementation(async () => {
      if (currentTable === "projects") {
        return { data: mocks.insertedProject, error: null };
      }
      return { data: null, error: { message: "Unexpected table" } };
    }),
  };
  return { getSupabase: () => chain };
});

import { GET, POST } from "../app/api/user/projects/route";

describe("user project routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetSessionUser.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  });

  it("lists only the current user's projects", async () => {
    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(200);
    expect(body.projects).toEqual(mocks.projectRows);
  });

  it("rejects unauthenticated project listing", async () => {
    mocks.mockGetSessionUser.mockResolvedValue(null);

    const response = await GET();
    const { status, body } = await parseResponse(response);

    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("creates a hosted repo for the signed-in user", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Repo Two" }),
    });

    const { status, body } = await parseResponse(await POST(request));

    expect(status).toBe(201);
    expect(body.project).toEqual(mocks.insertedProject);
  });

  it("validates missing repo names", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    const { status, body } = await parseResponse(await POST(request));

    expect(status).toBe(400);
    expect(body.error).toContain("name");
  });
});
