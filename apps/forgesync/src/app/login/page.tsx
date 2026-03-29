"use client";

import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const next = searchParams.get("next") || "/dashboard";
    const redirectUrl = new URL("/auth/callback", window.location.origin);
    redirectUrl.searchParams.set("next", next);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl.toString(),
      },
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>ForgeSync</h1>
        <p style={{ color: "#888", marginBottom: 32, fontSize: 14 }}>
          Sign in to manage your agent projects and API tokens.
        </p>
        {searchParams.get("error") === "auth" ? (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: "#2b1718",
              border: "1px solid #5f2a2d",
              color: "#f6c1c5",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            Sign-in could not be completed. Request a new magic link and try again.
          </div>
        ) : null}

        {sent ? (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              backgroundColor: "#1a2e1a",
              border: "1px solid #2d5a2d",
            }}
          >
            <p style={{ margin: 0, fontSize: 14 }}>
              Check your email for a magic link. Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="email"
              style={{ display: "block", fontSize: 13, color: "#aaa", marginBottom: 6 }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                borderRadius: 6,
                border: "1px solid #333",
                backgroundColor: "#141414",
                color: "#fafafa",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 16,
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 0",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 6,
                border: "none",
                backgroundColor: loading ? "#333" : "#fafafa",
                color: "#0a0a0a",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>
            {error && (
              <p style={{ color: "#e55", fontSize: 13, marginTop: 12 }}>{error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
