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

  const allTimes: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];

  return (
    <div className="ashvi-chat-bg-container" aria-hidden="true">
      {/* Background Images with smooth opacity crossfade */}
      {allTimes.map((tod) => {
        const theme = TIME_THEMES[tod];
        const isActive = tod === currentTime;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tod}
            src={theme.imageSrc}
            alt=""
            className={`ashvi-chat-bg-img ${isActive ? "active" : "inactive"}`}
          />
        );
      })}

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
