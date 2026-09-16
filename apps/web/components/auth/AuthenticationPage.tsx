"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticationEnvironment } from "./AuthenticationEnvironment";
import { AshviBrandPanel } from "./AshviBrandPanel";
import { SecureAccessCard } from "./SecureAccessCard";
import "./auth.css";

const base = process.env.NEXT_PUBLIC_ASHVI_API_URL ?? "http://127.0.0.1:4000";

type LoginState = "checking" | "locked" | "login" | "unlocking" | "authenticated";

export function AuthenticationPage({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<LoginState>("checking");
  const [username, setUsername] = useState("Aashu Singh");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch(`${base}/api/auth/session`, { credentials: "include" })
      .then((response) => {
        if (!isMounted) return;
        if (response.ok) {
          setState("authenticated");
          if (onSuccess) {
            onSuccess();
          } else {
            router.push("/");
          }
        } else {
          setState("login");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setState("login");
      });

    return () => {
      isMounted = false;
    };
  }, [router, onSuccess]);

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

      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      setCode("");
      setPassword("");

      if (!response.ok) {
        const denied = payload?.error?.message ?? "Access could not be verified.";
        setMessage(denied);
        if (response.status === 429) {
          setState("locked");
        }
        return;
      }

      setState("unlocking");
      window.setTimeout(() => {
        setState("authenticated");
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = "/";
        }
      }, 650);
    } catch {
      setMessage("The secure core is currently unreachable.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "checking") {
    return (
      <main className="auth-root">
        <AuthenticationEnvironment />
        <div className="auth-checking-shell">
          <div className="auth-checking-spinner" aria-hidden="true" />
          <p>Connecting Secure Channel</p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-root">
      {/* LAYER 1 & 2: Background photo & cinematic overlays */}
      <AuthenticationEnvironment />

      {/* LAYER 3: Coded UI (Editorial Left Branding + Right Dark Glass Card) */}
      <div className="auth-viewport-stage">
        <AshviBrandPanel />

        <SecureAccessCard
          state={state}
          username={username}
          setUsername={setUsername}
          code={code}
          setCode={setCode}
          password={password}
          setPassword={setPassword}
          message={message}
          submitting={submitting}
          onLogin={login}
        />
      </div>
    </main>
  );
}
