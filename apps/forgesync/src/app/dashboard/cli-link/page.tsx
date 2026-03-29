import { redirect } from "next/navigation";
import { CliLinkClient } from "../_components/cli-link-client";
import { getSupabase } from "@/app/api/agent/_supabase";
import { getSessionUser } from "@/lib/session-user";

type PageProps = {
  searchParams: Promise<{
    state?: string;
  }>;
};

export default async function CliLinkPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { state = "" } = await searchParams;
  if (!state) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "#0a0a0a", color: "#fafafa" }}>
        Missing CLI link state.
      </main>
    );
  }

  const db = getSupabase();
  const [{ data: linkSession }, { data: projects }] = await Promise.all([
    db.from("cli_link_sessions").select("requested_project_id, expires_at, completed_at").eq("state", state).single(),
    db.from("projects").select("id, name").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  if (!linkSession || new Date(linkSession.expires_at) < new Date()) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "#0a0a0a", color: "#fafafa" }}>
        CLI link session is invalid or expired.
      </main>
    );
  }

  if (linkSession.completed_at) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "#0a0a0a", color: "#fafafa" }}>
        This CLI link has already been completed.
      </main>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "#0a0a0a", color: "#fafafa", padding: 24 }}>
        <div style={{ maxWidth: 460, textAlign: "center", fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <h1 style={{ marginBottom: 12 }}>Create a repo first</h1>
          <p style={{ color: "#9aa39f", lineHeight: 1.6 }}>
            This account does not have any hosted repos yet. Create one in the dashboard, then retry the CLI login flow.
          </p>
          <a href="/dashboard" style={{ color: "#d7f9e9" }}>
            Go to dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <CliLinkClient
      state={state}
      requestedProjectId={linkSession.requested_project_id || null}
      projects={projects || []}
    />
  );
}
