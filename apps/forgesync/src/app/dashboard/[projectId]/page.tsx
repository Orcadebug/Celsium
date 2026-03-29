"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Token = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  expires_at?: string | null;
  scopes?: string[] | null;
  last_used_at?: string | null;
};

type Session = {
  id: string;
  agent_id: string | null;
  agent_name?: string | null;
  intent: string | null;
  status: string;
  started_at: string;
};

type Project = {
  id: string;
  name: string;
  repo_url?: string | null;
  created_at: string;
};

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newTokenName, setNewTokenName] = useState("default");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    const response = await fetch(`/api/user/projects/${projectId}`);
    const data = (await response.json()) as { error?: string; project?: Project };
    if (!response.ok || !data.project) {
      throw new Error(data.error || "Failed to load repo.");
    }
    setProject(data.project);
  }, [projectId]);

  const fetchTokens = useCallback(async () => {
    const response = await fetch("/api/user/tokens");
    const data = (await response.json()) as { error?: string; tokens?: Token[] };
    if (!response.ok) {
      throw new Error(data.error || "Failed to load tokens.");
    }
    setTokens((data.tokens || []).filter((token) => token.project_id === projectId));
  }, [projectId]);

  const fetchSessions = useCallback(async () => {
    const response = await fetch(`/api/user/projects/${projectId}/sessions`);
    const data = (await response.json()) as { error?: string; sessions?: Session[] };
    if (!response.ok) {
      throw new Error(data.error || "Failed to load sessions.");
    }
    setSessions(data.sessions || []);
  }, [projectId]);

  const loadProjectState = useCallback(async () => {
    setInitialLoading(true);
    setError(null);
    try {
      await Promise.all([fetchProject(), fetchTokens(), fetchSessions()]);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setInitialLoading(false);
    }
  }, [fetchProject, fetchSessions, fetchTokens]);

  useEffect(() => {
    void loadProjectState();
  }, [loadProjectState]);

  async function createToken() {
    const trimmedName = newTokenName.trim();
    if (!trimmedName) {
      setError("Token name is required.");
      return;
    }

    setLoading(true);
    setCreatedToken(null);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/user/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name: trimmedName }),
      });
      const data = (await response.json()) as { error?: string; token?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to create token.");
      }
      if (!data.token) {
        throw new Error("Token response was missing the new token.");
      }

      setCreatedToken(data.token);
      setCopied(false);
      setNewTokenName("default");
      setStatus(`Created ${trimmedName}. Copy it now; it will not be shown again.`);
      await fetchTokens();
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function revokeToken(id: string) {
    setRevokingTokenId(id);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/user/tokens", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to revoke token.");
      }

      setStatus("Token revoked.");
      await fetchTokens();
    } catch (revokeError) {
      setError((revokeError as Error).message);
    } finally {
      setRevokingTokenId(null);
    }
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
  }

  const activeSessions = sessions.filter((session) => session.status === "active");
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

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
        {error ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              backgroundColor: "#2b1718",
              border: "1px solid #5f2a2d",
              color: "#f6c1c5",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        ) : null}
        {status ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              backgroundColor: "#14251e",
              border: "1px solid #29463a",
              color: "#b9e8d3",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {status}
          </div>
        ) : null}
        <div style={{ marginBottom: 8 }}>
          <a href="/dashboard" style={{ color: "#888", fontSize: 13, textDecoration: "none" }}>
            &larr; Repos
          </a>
        </div>

        {initialLoading ? (
          <section
            style={{
              padding: 24,
              borderRadius: 12,
              border: "1px solid #222",
              backgroundColor: "#111",
              color: "#9aa39f",
              marginBottom: 32,
            }}
          >
            Loading repo details...
          </section>
        ) : null}

        {!initialLoading && !project ? (
          <section
            style={{
              padding: 24,
              borderRadius: 12,
              border: "1px solid #3a2222",
              backgroundColor: "#171010",
              color: "#f2d0d0",
            }}
          >
            This hosted repo was not found or you no longer have access to it.
          </section>
        ) : null}

        {project ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{project.name}</h1>
                <code style={{ fontSize: 12, color: "#666" }}>{project.id}</code>
                {project.repo_url ? (
                  <div style={{ fontSize: 13, color: "#8da59c", marginTop: 6 }}>{project.repo_url}</div>
                ) : null}
              </div>
            </div>

        <section
          style={{
            marginBottom: 32,
            padding: 18,
            borderRadius: 12,
            border: "1px solid #1e2b25",
            background: "linear-gradient(135deg, #101614 0%, #111 100%)",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 10px" }}>Connect CLI</h2>
          <p style={{ color: "#8da59c", fontSize: 13, margin: "0 0 12px" }}>
            Browser-linked login is the primary onboarding path. The terminal opens a browser, you
            approve this repo, and the CLI stores a scoped token locally.
          </p>
          <code
            style={{
              display: "block",
              padding: "10px 12px",
              borderRadius: 8,
              backgroundColor: "#141414",
              fontSize: 12,
              color: "#d7f9e9",
              whiteSpace: "pre-wrap",
            }}
          >
            {`forgesync login --api ${appUrl}\nforgesync sync`}
          </code>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Active Agents ({activeSessions.length})
          </h2>
          {activeSessions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #1a3a1a",
                    backgroundColor: "#0d1f0d",
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{session.agent_name || session.agent_id || "unknown-agent"}</span>
                  {session.intent ? <span style={{ color: "#888" }}> — {session.intent}</span> : null}
                  <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
                    Started {new Date(session.started_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#555", fontSize: 13 }}>No active agents.</p>
          )}
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>API Tokens</h2>

          {createdToken ? (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                backgroundColor: "#1a2e1a",
                border: "1px solid #2d5a2d",
                marginBottom: 16,
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>
                Token created — copy it now, it will not be shown again:
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <code
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    backgroundColor: "#0a0a0a",
                    fontSize: 12,
                    wordBreak: "break-all",
                  }}
                >
                  {createdToken}
                </code>
                <button
                  onClick={copyToken}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #333",
                    backgroundColor: copied ? "#2d5a2d" : "#222",
                    color: "#fafafa",
                    cursor: "pointer",
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={newTokenName}
              onChange={(event) => setNewTokenName(event.target.value)}
              placeholder="Token name"
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid #333",
                backgroundColor: "#141414",
                color: "#fafafa",
                outline: "none",
              }}
            />
            <button
              onClick={createToken}
              disabled={loading || !newTokenName.trim()}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                border: "none",
                backgroundColor: "#fafafa",
                color: "#0a0a0a",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating..." : "Create token"}
            </button>
          </div>

          {tokens.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tokens.map((token) => (
                <div
                  key={token.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #222",
                    backgroundColor: "#111",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{token.name}</span>
                    <span style={{ color: "#555", marginLeft: 8, fontSize: 11 }}>
                      Created {new Date(token.created_at).toLocaleDateString()}
                    </span>
                    {token.last_used_at ? (
                      <span style={{ color: "#555", marginLeft: 8, fontSize: 11 }}>
                        Last used {new Date(token.last_used_at).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => revokeToken(token.id)}
                    disabled={revokingTokenId === token.id}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      borderRadius: 4,
                      border: "1px solid #333",
                      backgroundColor: "transparent",
                      color: "#e55",
                      cursor: revokingTokenId === token.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {revokingTokenId === token.id ? "Revoking..." : "Revoke"}
                  </button>
              </div>
            ))}
          </div>
          ) : (
            <p style={{ color: "#555", fontSize: 13 }}>No tokens yet.</p>
          )}
        </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
