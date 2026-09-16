"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChatWorkspace } from "./chat-workspace";

const base = process.env.NEXT_PUBLIC_ASHVI_API_URL ?? "http://127.0.0.1:4000";

type LoginState = "checking" | "locked" | "login" | "authenticated";

export function AuthGate() {
  const [state, setState] = useState<LoginState>("checking");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch(`${base}/api/auth/session`, { credentials: "include" })
      .then((response) => setState(response.ok ? "authenticated" : "login"))
      .catch(() => {
        setState("login");
        setMessage("The secure core is unavailable.");
      });
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !code || !password || submitting) return;

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), code, password }),
      });
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      setCode("");
      setPassword("");
      if (!response.ok) {
        const denied = payload?.error?.message ?? "Access could not be verified.";
        setMessage(denied);
        if (response.status === 429) setState("locked");
        return;
      }
      setState("authenticated");
    } catch {
      setMessage("The secure core is unavailable.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "checking") return <main className="security-shell"><div className="security-card"><div className="security-spinner" /><p>Checking secure core…</p></div></main>;
  if (state === "authenticated") return <ChatWorkspace />;

  return (
    <main className="security-shell">
      <section className="security-card" aria-labelledby="security-title">
        <div className="security-emblem"><span /><i /><b /></div>
        <p className="security-kicker">ASHVI SECURE CORE</p>
        <h1 id="security-title">Private access</h1>
        <p className="security-subtitle">Identity verification required</p>

        {state === "locked" ? (
          <div className="security-locked" role="alert">
            <strong>Access temporarily locked</strong>
            <span>Too many unsuccessful attempts. Please use the authorized recovery process.</span>
          </div>
        ) : (
          <form className="security-form" onSubmit={login}>
            <label>Authorized identity<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={submitting} /></label>
            <label>Secret access code<input type="password" inputMode="numeric" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} disabled={submitting} /></label>
            <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} /></label>
            {message && <p className="security-warning" role="alert">{message}</p>}
            <button className="security-submit" type="submit" disabled={submitting}>{submitting ? "Verifying identity…" : "Verify identity"}</button>
          </form>
        )}
        <small className="security-status"><span /> Encrypted session boundary active</small>
      </section>
    </main>
  );
}
