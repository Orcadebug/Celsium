export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 32,
        fontFamily: "system-ui, -apple-system, sans-serif",
        background:
          "radial-gradient(circle at top, rgba(53, 112, 88, 0.28), transparent 42%), #0a0a0a",
        color: "#fafafa",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 40, marginBottom: 12 }}>ForgeSync</h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: "#b5c4be", maxWidth: 640 }}>
          Hosted context repos for AI agents. Link a workspace from the CLI, sync code and notes
          into a shared knowledge base, and manage tokens and active sessions from the dashboard.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <a
            href="/login"
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              backgroundColor: "#e9fff3",
              color: "#0b2116",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Sign In
          </a>
          <a
            href="/dashboard"
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #355648",
              color: "#d6f7e8",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Open Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
