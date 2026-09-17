"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticationEnvironment } from "./AuthenticationEnvironment";
import { AshviBrandPanel } from "./AshviBrandPanel";
import { SecureAccessCard } from "./SecureAccessCard";
import { getApiBaseUrl, getAuthHeaders, setAuthToken } from "@/lib/api";
import "./auth.css";

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
    fetch(`${getApiBaseUrl()}/api/auth/session`, { credentials: "include", cache: "no-store", headers: getAuthHeaders() })
      .then((response) => {
        if (!isMounted) return;
        if (response.ok) {
          setState("authenticated");
          if (onSuccess) {
            onSuccess();
          } else {
            router.push("/");
          }
        } else if (response.status >= 500) {
          setState("login");
          setMessage("The secure core is currently unreachable.");
        } else {
          setState("login");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setState("login");
        setMessage("The secure core is currently unreachable.");
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
      const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), code: code.trim(), password }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
        token?: string;
      } | null;

      setCode("");
      setPassword("");

      if (!response.ok) {
        if (response.status >= 500) {
          setMessage("The secure core server is offline or unreachable from this host.");
          return;
        }
        const denied = payload?.error?.message ?? "Access could not be verified. Please check your secret code and password.";
        setMessage(denied);
        if (response.status === 429) {
          setState("locked");
        }
        return;
      }

      if (payload?.token) {
        setAuthToken(payload.token);
      }

      setState("unlocking");
      window.setTimeout(() => {
        setState("authenticated");
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/");
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
