"use client";

import { AshviCoreOrb } from "../core/AshviCoreOrb";

interface Props {
  onSelectTag?: (tag: string) => void;
}

export function HeroSection({ onSelectTag }: Props) {
  const tags = ["Ideas", "Knowledge", "Projects", "Growth", "A Better You"];

  // Format dynamic date similar to reference (e.g. "SUN, 14 SEPT 2026")
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).toUpperCase();

  return (
    <section className="ashvi-hero-container" aria-label="Welcome banner">
      <div className="ashvi-hero-left">
        <div className="ashvi-date-stamp" aria-label="Current date">
          {dateStr}
        </div>
        <h2 className="ashvi-hero-greeting">
          Good evening,<br />
          Aashu.
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
