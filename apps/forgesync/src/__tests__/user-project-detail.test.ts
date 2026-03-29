import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "./helpers";

const mocks = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  state: {
    projectRecord: {
      id: "proj-1",
      name: "Repo One",
      repo_url: "https://github.com/acme/repo-one",
      created_at: "2026-03-28T00:00:00.000Z",
    } as Record<string, unknown> | null,
    projectError: null as { message: string } | null,
  },
}));

vi.mock("@/lib/session-user", () => ({
  getSessionUser: mocks.mockGetSessionUser,
}));

vi.mock("../app/api/agent/_supabase", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(async () => ({
      data: mocks.state.projectRecord,
      error: mocks.state.projectError,
    })),
  };
  chain.from.mockReturnValue(chain);
  return { getSupabase: () => chain };
});

import { GET } from "../app/api/user/projects/[projectId]/route";

describe("GET /api/user/projects/[projectId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetSessionUser.mockResolvedValue({ id: "user-1" });
    mocks.state.projectRecord = {
      id: "proj-1",
      name: "Repo One",
      repo_url: "https://github.com/acme/repo-one",
      created_at: "2026-03-28T00:00:00.000Z",
    };
    mocks.state.projectError = null;
  });

  it("returns the current user's project detail", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/projects/proj-1");
    const context = { params: Promise.resolve({ projectId: "proj-1" }) };

    const { status, body } = await parseResponse(await GET(request, context));

    expect(status).toBe(200);
    expect(body.project).toEqual(mocks.state.projectRecord);
  });

  it("returns 404 for missing projects", async () => {
    mocks.state.projectRecord = null;
    mocks.state.projectError = { message: "Not found" };

    const request = new NextRequest("http://localhost:3000/api/user/projects/proj-1");
    const context = { params: Promise.resolve({ projectId: "proj-1" }) };

    const { status, body } = await parseResponse(await GET(request, context));

    expect(status).toBe(404);
    expect(body.error).toBe("Project not found");
  });
});
