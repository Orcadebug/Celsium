"use client";

import { useState } from "react";

type Project = {
  id: string;
  name: string;
  repo_url?: string | null;
  created_at: string;
};

export function DashboardHome(props: {
  email: string | undefined;
  appUrl: string;
  initialProjects: Project[];
}) {
  const [projects, setProjects] = useState<Project[]>(props.initialProjects);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function createProject() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Repo name is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/user/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = (await response.json()) as { error?: string; project?: Project };
      if (!response.ok) {
        throw new Error(data.error || "Failed to create repo");
      }
      if (!data.project) {
        throw new Error("Project response was missing the created repo.");
      }

      setProjects((current) => [data.project!, ...current]);
      setName("");
      setStatus(`Created ${data.project.name}. Open it to create tokens or link the CLI.`);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#0a0a0a",
        color: "#fafafa",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
            gap: 24,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Hosted Context Repos</h1>
            <p style={{ color: "#888", fontSize: 13, margin: "6px 0 0" }}>
              {props.email || "Signed in"} · local workspaces sync into hosted semantic repos.
            </p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              style={{
                padding: "6px 14px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid #333",
                backgroundColor: "transparent",
                color: "#888",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>

        <section
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              border: "1px solid #222",
              background: "linear-gradient(135deg, #111 0%, #0f1b17 100%)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>Create A Repo</h2>
            <p style={{ color: "#888", fontSize: 13, margin: "8px 0 16px" }}>
              Each repo is a hosted context space. Sync a local workspace into it from the CLI.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="customer-support-brain"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  fontSize: 14,
                  borderRadius: 8,
                  border: "1px solid #333",
                  backgroundColor: "#141414",
                  color: "#fafafa",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={createProject}
                disabled={loading || !name.trim()}
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#fafafa",
                  color: "#0a0a0a",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
            {error ? <p style={{ color: "#f28b82", fontSize: 12, margin: "10px 0 0" }}>{error}</p> : null}
            {status ? <p style={{ color: "#9ad0b7", fontSize: 12, margin: "10px 0 0" }}>{status}</p> : null}
          </div>

          <div
            style={{
              padding: 20,
              borderRadius: 12,
              border: "1px solid #222",
              backgroundColor: "#101010",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>CLI Onboarding</h2>
            <p style={{ color: "#888", fontSize: 13, margin: "8px 0 14px" }}>
              Sign in from the terminal, link a repo, then push file context with explicit sync.
            </p>
            <code
              style={{
                display: "block",
                padding: "10px 12px",
                borderRadius: 8,
                backgroundColor: "#141414",
                color: "#d7f9e9",
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {`forgesync login --api ${props.appUrl}\nforgesync sync`}
            </code>
          </div>
        </section>

        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Your Repos</h2>

        {projects.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {projects.map((project) => (
              <a
                key={project.id}
                href={`/dashboard/${project.id}`}
                style={{
                  display: "block",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid #222",
                  backgroundColor: "#111",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{project.name}</div>
                      <div style={{ fontSize: 12, color: "#666", fontFamily: "monospace" }}>{project.id}</div>
                      {project.repo_url ? (
                        <div style={{ fontSize: 12, color: "#7f8f89", marginTop: 6 }}>{project.repo_url}</div>
                      ) : null}
                    </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {new Date(project.created_at).toLocaleDateString()}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: 32,
              borderRadius: 12,
              border: "1px dashed #333",
              textAlign: "center",
              color: "#888",
              fontSize: 14,
            }}
          >
            No hosted repos yet. Create one above, then link the CLI and run your first sync.
          </div>
        )}
      </div>
    </main>
  );
}
