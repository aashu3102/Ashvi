"use client";

import { useEffect, useState } from "react";
import { AshviCoreOrb } from "../core/AshviCoreOrb";
import { getTimeOfDay, TimeOfDay } from "@/lib/time-of-day";

interface Props {
  onSelectTag?: (tag: string) => void;
  userName?: string | null;
}

export function HeroSection({ onSelectTag, userName }: Props) {
  const tags = ["Ideas", "Knowledge", "Projects", "Growth", "A Better You"];
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeOfDay(getTimeOfDay());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Format dynamic date similar to reference (e.g. "SUN, 14 SEPT 2026")
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).toUpperCase();

  const greetingWord = timeOfDay === "morning"
    ? "Good morning"
    : timeOfDay === "afternoon"
    ? "Good afternoon"
    : timeOfDay === "evening"
    ? "Good evening"
    : "Good night";

  const displayName = userName ? userName.trim().split(" ")[0] : "Aashu";

  return (
    <section className="ashvi-hero-container" aria-label="Welcome banner">
      <div className="ashvi-hero-left">
        <div className="ashvi-date-stamp" aria-label="Current date">
          {dateStr}
        </div>
        <h2 className="ashvi-hero-greeting">
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
