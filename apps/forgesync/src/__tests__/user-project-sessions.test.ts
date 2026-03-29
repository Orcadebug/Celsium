import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "./helpers";

const mocks = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  state: {
    projectRecord: { id: "proj-1" } as Record<string, unknown> | null,
    projectError: null as { message: string } | null,
  },
  sessions: [
    {
      id: "session-1",
      agent_id: "codex",
      agent_name: "Codex",
      intent: "ship dashboard polish",
      status: "active",
      started_at: "2026-03-28T12:00:00.000Z",
    },
  ],
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
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async () => {
      if (currentTable === "sessions") {
        return { data: mocks.sessions, error: null };
      }
      return { data: [], error: { message: "Unexpected table" } };
    }),
    single: vi.fn().mockImplementation(async () => ({
      data: currentTable === "projects" ? mocks.state.projectRecord : null,
      error: currentTable === "projects" ? mocks.state.projectError : { message: "Unexpected table" },
    })),
  };
  return { getSupabase: () => chain };
});

import { GET } from "../app/api/user/projects/[projectId]/sessions/route";

describe("GET /api/user/projects/[projectId]/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetSessionUser.mockResolvedValue({ id: "user-1" });
    mocks.state.projectRecord = { id: "proj-1" };
    mocks.state.projectError = null;
  });

  it("returns recent sessions for the user's project", async () => {
    const request = new NextRequest("http://localhost:3000/api/user/projects/proj-1/sessions");
    const context = { params: Promise.resolve({ projectId: "proj-1" }) };

    const { status, body } = await parseResponse(await GET(request, context));

    expect(status).toBe(200);
    expect(body.sessions).toEqual(mocks.sessions);
  });

  it("returns 404 when the project is not owned by the user", async () => {
    mocks.state.projectRecord = null;
    mocks.state.projectError = { message: "Not found" };

    const request = new NextRequest("http://localhost:3000/api/user/projects/proj-1/sessions");
    const context = { params: Promise.resolve({ projectId: "proj-1" }) };

    const { status, body } = await parseResponse(await GET(request, context));

    expect(status).toBe(404);
    expect(body.error).toBe("Project not found");
  });
});
