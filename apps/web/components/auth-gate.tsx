"use client";

import { useEffect, useState } from "react";
import { AuthenticationPage } from "./auth/AuthenticationPage";
import { AshviShell } from "./ashvi/layout/AshviShell";
import { getApiBaseUrl } from "@/lib/api";
import "./auth/auth.css";

export function AuthGate() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch(`${getApiBaseUrl()}/api/auth/session`, { credentials: "include" })
      .then((res) => {
        if (isMounted) setAuthenticated(res.ok);
      })
      .catch(() => {
        if (isMounted) setAuthenticated(false);
      });

    return () => {
      isMounted = false;
    };
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
    return <AshviShell />;
  }

  return <AuthenticationPage onSuccess={() => setAuthenticated(true)} />;
}
