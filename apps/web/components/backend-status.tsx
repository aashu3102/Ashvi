"use client";

import { useCallback, useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "@/lib/api";

type Status = "loading" | "connected" | "error";

export function BackendStatus() {
  const [status, setStatus] = useState<Status>("loading");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const checkConnection = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await getHealth();
      setHealth(result);
      setStatus("connected");
    } catch {
      setHealth(null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getHealth()
      .then((result) => {
        if (active) {
          setHealth(result);
          setStatus("connected");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return <p className="mt-8 text-sm text-slate-400">Checking Ashvi backend…</p>;
  }

  if (status === "error") {
    return (
      <div className="mt-8 space-y-3">
        <p className="text-sm text-amber-300">Ashvi backend is unavailable.</p>
        <button className="rounded-md border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800" onClick={() => void checkConnection()}>
          Retry connection
        </button>
      </div>
    );
  }

  return (
    <p className="mt-8 text-sm text-emerald-300">
      Backend connected · PostgreSQL {health?.database}
    </p>
  );
}
