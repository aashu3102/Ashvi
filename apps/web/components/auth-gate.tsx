"use client";

import { useEffect, useState } from "react";
import { AuthenticationPage } from "./auth/AuthenticationPage";
import { AshviShell } from "./ashvi/layout/AshviShell";
import { getApiBaseUrl, getAuthHeaders } from "@/lib/api";
import "./auth/auth.css";

export function AuthGate() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const verifySession = () => {
    let isMounted = true;
    fetch(`${getApiBaseUrl()}/api/auth/session`, { credentials: "include", cache: "no-store", headers: getAuthHeaders() })
      .then(async (res) => {
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (isMounted) {
            setUserName(data?.user?.name || null);
            setAuthenticated(true);
          }
        } else {
          setAuthenticated(false);
        }
      })
      .catch(() => {
        if (isMounted) setAuthenticated(false);
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    return verifySession();
  }, []);

  if (authenticated === null) {
    return (
      <div className="auth-root">
        <div className="auth-photo-layer" aria-hidden="true" />
        <div className="auth-checking-shell">
          <div className="auth-checking-spinner" aria-hidden="true" />
          <p>Connecting Secure Channel</p>
        </div>
      </div>
    );
  }

  if (authenticated) {
    return <AshviShell userName={userName} />;
  }

  return <AuthenticationPage onSuccess={() => verifySession()} />;
}
