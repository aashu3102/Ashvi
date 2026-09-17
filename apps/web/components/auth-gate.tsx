"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthenticationPage } from "./auth/AuthenticationPage";
import { AshviShell } from "./ashvi/layout/AshviShell";
import {
  clearAuthToken,
  clearCachedUser,
  getApiBaseUrl,
  getAuthHeaders,
  getAuthToken,
  getCachedUser,
  logoutSession,
  setCachedUser,
} from "@/lib/api";
import "./auth/auth.css";

export function AuthGate() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(() => {
    if (typeof window !== "undefined") {
      const token = getAuthToken();
      // If no token exists, immediately show login page with 0ms delay!
      if (!token) return false;
      // If token exists, optimistically mount shell immediately
      return true;
    }
    return null;
  });

  const [userName, setUserName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return getCachedUser();
    }
    return null;
  });

  const verifySession = useCallback(() => {
    let isMounted = true;
    const token = getAuthToken();
    if (!token) {
      Promise.resolve().then(() => {
        if (isMounted) setAuthenticated(false);
      });
      return () => {
        isMounted = false;
      };
    }

    fetch(`${getApiBaseUrl()}/api/auth/session`, {
      credentials: "include",
      cache: "no-store",
      headers: getAuthHeaders(),
    })
      .then(async (res) => {
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (isMounted) {
            const name = data?.user?.name || null;
            if (name) {
              setUserName(name);
              setCachedUser(name);
            }
            setAuthenticated(true);
          }
        } else {
          // Token is revoked or invalid
          clearAuthToken();
          clearCachedUser();
          if (isMounted) {
            setAuthenticated(false);
            setUserName(null);
          }
        }
      })
      .catch(() => {
        // Network failure during session check
        if (isMounted && !getAuthToken()) {
          setAuthenticated(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return verifySession();
  }, [verifySession]);

  const handleLogout = async () => {
    await logoutSession();
    setAuthenticated(false);
    setUserName(null);
  };

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
    return <AshviShell userName={userName} onLogout={handleLogout} />;
  }

  return <AuthenticationPage onSuccess={() => verifySession()} />;
}
