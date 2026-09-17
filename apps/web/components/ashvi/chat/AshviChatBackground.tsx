"use client";

import { useEffect, useState } from "react";
import { getTimeOfDay, TIME_THEMES, TimeOfDay } from "@/lib/time-of-day";

interface Props {
  forcedTimeOfDay?: TimeOfDay;
}

export function AshviChatBackground({ forcedTimeOfDay }: Props) {
  const [localTime, setLocalTime] = useState<TimeOfDay>(() => getTimeOfDay());

  // Check periodically (every 30s) if the time-of-day period has changed
  useEffect(() => {
    if (forcedTimeOfDay) return;

    const interval = setInterval(() => {
      const nextTime = getTimeOfDay();
      setLocalTime((prev) => (prev !== nextTime ? nextTime : prev));
    }, 30000);

    return () => clearInterval(interval);
  }, [forcedTimeOfDay]);

  const currentTime = forcedTimeOfDay || localTime;
  const activeTheme = TIME_THEMES[currentTime];

  return (
    <div className="ashvi-chat-bg-container" aria-hidden="true">
      {/* High-fidelity single active background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentTime}
        src={activeTheme.imageSrc}
        alt=""
        className="ashvi-chat-bg-img active"
        decoding="async"
        fetchPriority="high"
      />

      {/* Atmospheric lighting and radial vignette */}
      <div className="ashvi-chat-atmosphere" />

      {/* Ambient glowing aura matching current scene */}
      <div
        className="ashvi-chat-ambient-glow"
        style={{
          backgroundColor: activeTheme.glowColor,
        }}
      />
    </div>
  );
}
