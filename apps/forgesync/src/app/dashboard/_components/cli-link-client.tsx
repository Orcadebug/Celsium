"use client";

import { useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
};

export function CliLinkClient(props: {
  state: string;
  requestedProjectId: string | null;
  projects: Project[];
}) {
  const defaultProjectId = useMemo(() => {
    if (props.requestedProjectId) {
      return props.requestedProjectId;
    }
    return props.projects[0]?.id ?? "";
  }, [props.projects, props.requestedProjectId]);

  const [projectId, setProjectId] = useState(defaultProjectId);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function linkCli() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/cli/link/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: props.state, project_id: projectId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to link CLI");
      }

      window.location.href = data.redirect_url;
    } catch (linkError) {
      setError((linkError as Error).message);
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top, rgba(41,92,74,0.32), transparent 45%), #0a0a0a",
        color: "#fafafa",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          padding: 28,
          borderRadius: 16,
          border: "1px solid #1f2f28",
          backgroundColor: "rgba(12, 18, 16, 0.92)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26 }}>Link CLI</h1>
        <p style={{ color: "#92a79f", fontSize: 14, lineHeight: 1.6, margin: "10px 0 20px" }}>
          Choose which hosted repo this terminal should connect to. The CLI will receive a scoped
          API token over the localhost callback and store it locally.
        </p>

        <label style={{ display: "block", fontSize: 13, color: "#aec2ba", marginBottom: 8 }}>
          Hosted repo
        </label>
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            borderRadius: 8,
            border: "1px solid #33463f",
            backgroundColor: "#101614",
            color: "#fafafa",
            marginBottom: 16,
          }}
        >
          {props.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        {error ? <p style={{ color: "#f28b82", fontSize: 12 }}>{error}</p> : null}

        <button
          type="button"
          onClick={linkCli}
          disabled={loading || !projectId}
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            backgroundColor: "#e8fff0",
            color: "#092215",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Linking..." : "Link This CLI"}
        </button>
      </div>
    </main>
  );
}
