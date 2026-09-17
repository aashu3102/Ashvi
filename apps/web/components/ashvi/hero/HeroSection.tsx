"use client";

import { useEffect, useState } from "react";
import { AshviCoreOrb } from "../core/AshviCoreOrb";
import { getTimeOfDay, getGreetingWord, TimeOfDay } from "@/lib/time-of-day";
import { getApiBaseUrl, getAuthHeaders } from "@/lib/api";

interface Props {
  onSelectTag?: (tag: string) => void;
  userName?: string | null;
}

export function HeroSection({ onSelectTag, userName }: Props) {
  const tags = ["Ideas", "Knowledge", "Projects", "Growth", "A Better You"];
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay(new Date()));
  const [fetchedName, setFetchedName] = useState<string>("");

  // Calculate browser/device local time safely and update as time periods change
  useEffect(() => {
    const timer = setInterval(() => {
      const next = getTimeOfDay(new Date());
      setTimeOfDay((prev) => (prev !== next ? next : prev));
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  // Dynamically resolve authenticated operator name if not passed via props
  useEffect(() => {
    if (userName) return;

    fetch(`${getApiBaseUrl()}/api/auth/session`, { credentials: "include", cache: "no-store", headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.name) {
          setFetchedName(data.user.name.trim().split(" ")[0]);
        }
      })
      .catch(() => {});
  }, [userName]);

  // Format dynamic date similar to reference (e.g. "SUN, 14 SEPT 2026")
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).toUpperCase();

  const greetingWord = getGreetingWord(timeOfDay);
  const cleanPropName = userName ? userName.trim().split(" ")[0] : "";
  const displayName = cleanPropName || fetchedName || "Aashu";

  return (
    <section className="ashvi-hero-container" aria-label="Welcome banner">
      <div className="ashvi-hero-left">
        <div className="ashvi-date-stamp" aria-label="Current date" suppressHydrationWarning>
          {dateStr}
        </div>
        <h2 className="ashvi-hero-greeting" suppressHydrationWarning>
          {greetingWord},<br />
          {displayName}.
        </h2>
        <p className="ashvi-hero-question">What are we creating today?</p>
        <p className="ashvi-hero-motto">Think deeply. Build boldly. Explore freely.</p>

        <div className="ashvi-tag-pills-row" aria-label="Topic suggestions">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="ashvi-tag-pill"
              onClick={() => onSelectTag && onSelectTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="ashvi-hero-right-visuals">
        <AshviCoreOrb />
        <div className="ashvi-landscape-discipline" aria-hidden="true">
          <span>DISCIPLINE</span>
          <span>CREATES</span>
          <span>FREEDOM</span>
        </div>
      </div>
    </section>
  );
}
