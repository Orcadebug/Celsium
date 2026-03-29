import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExchangeCodeForSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

import { GET } from "../app/auth/callback/route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("redirects to the requested in-origin path after sign-in", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback?code=test&next=%2Fdashboard%2Fcli-link");
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard/cli-link");
  });

  it("blocks open redirects by falling back to the dashboard", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback?code=test&next=https://evil.example/");
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("redirects to login when the auth exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: "nope" } });

    const request = new NextRequest("http://localhost:3000/auth/callback?code=test");
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=auth");
  });
});
