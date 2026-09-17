"use client";

import { useEffect, useState } from "react";

export type DayPeriod = "morning" | "afternoon" | "evening" | "night";

export interface TimeDetectionResult {
  // System time and timezone (primary source of truth)
  systemDate: Date;
  systemTimeFormatted: string;
  systemTimezone: string;
  systemHour: number;
  systemMinute: number;

  // India reference clock (Asia/Kolkata IANA)
  indiaTimeFormatted: string;
  indiaTimezone: "Asia/Kolkata";
  indiaHour: number;
  indiaMinute: number;

  // Period & greeting
  period: DayPeriod;
  greetingWord: string;
}

/**
 * Pure period determination based on local hour (0-23) and minute (0-59):
 * - 05:00 – 11:59 -> "morning"   ("Good morning")
 * - 12:00 – 16:59 -> "afternoon" ("Good afternoon")
 * - 17:00 – 20:59 -> "evening"   ("Good evening")
 * - 21:00 – 04:59 -> "night"     ("Good night")
 *
 * NOTE: getUTCHours() is STRICTLY FORBIDDEN here.
 * Only local system hours are used.
 */
export function determinePeriod(hour: number, _minute?: number): DayPeriod {
  void _minute;
  // Validate boundaries
  if (hour >= 5 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }
  if (hour >= 17 && hour < 21) {
    return "evening";
  }
  return "night";
}

/**
 * Maps DayPeriod to the canonical Ashvi greeting word.
 * Guaranteed: NO hardcoded "Good evening" fallback.
 */
export function periodToGreeting(period: DayPeriod): string {
  switch (period) {
    case "morning":
      return "Good morning";
    case "afternoon":
      return "Good afternoon";
    case "evening":
      return "Good evening";
    case "night":
      return "Good night";
  }
}

/**
 * Automatically detects the runtime/browser's actual local timezone.
 * Uses Intl.DateTimeFormat().resolvedOptions().timeZone.
 * Does NOT hardcode Asia/Kolkata or any specific timezone.
 */
export function detectSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Calculates current India Standard Time using official IANA timezone "Asia/Kolkata".
 * Used strictly as a reference/verification clock.
 * Does NOT use hardcoded UTC+5:30 offsets.
 */
export function getIndiaReferenceTime(date: Date = new Date()): {
  formatted: string;
  hour: number;
  minute: number;
  timezone: "Asia/Kolkata";
} {
  const displayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });

  const hour24Formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = hour24Formatter.formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour");
  const minutePart = parts.find((p) => p.type === "minute");

  return {
    formatted: displayFormatter.format(date),
    hour: hourPart ? parseInt(hourPart.value, 10) : 0,
    minute: minutePart ? parseInt(minutePart.value, 10) : 0,
    timezone: "Asia/Kolkata",
  };
}

/**
 * Centralized automatic time detection:
 * 1. Current system time (using browser local time methods, NOT UTC)
 * 2. Current system timezone (via Intl.DateTimeFormat)
 * 3. Current India time (via IANA Asia/Kolkata)
 * 4. Day period and greeting calculation
 */
export function detectTime(date: Date = new Date()): TimeDetectionResult {
  // CRITICAL: Uses host system local time methods, NEVER getUTCHours()
  const systemHour = date.getHours();
  const systemMinute = date.getMinutes();
  const systemTimezone = detectSystemTimezone();

  const systemTimeFormatted = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });

  const india = getIndiaReferenceTime(date);
  const period = determinePeriod(systemHour, systemMinute);
  const greetingWord = periodToGreeting(period);

  return {
    systemDate: date,
    systemTimeFormatted,
    systemTimezone,
    systemHour,
    systemMinute,
    indiaTimeFormatted: india.formatted,
    indiaTimezone: "Asia/Kolkata",
    indiaHour: india.hour,
    indiaMinute: india.minute,
    period,
    greetingWord,
  };
}

/**
 * Safe development-only console diagnostics.
 * Will not run in production.
 */
export function logTimeDiagnostics(result: TimeDetectionResult): void {
  if (process.env.NODE_ENV !== "development") return;

  // Safe developer logging only
  console.log(
    `%c[Ashvi Time Detection]\n` +
    `--------------------\n` +
    `System Time:     ${result.systemTimeFormatted} (Hour: ${result.systemHour}:${String(result.systemMinute).padStart(2, "0")})\n` +
    `System Timezone: ${result.systemTimezone}\n` +
    `India Time:      ${result.indiaTimeFormatted} (Hour: ${result.indiaHour}:${String(result.indiaMinute).padStart(2, "0")})\n` +
    `India Timezone:  ${result.indiaTimezone}\n` +
    `Detected Period: ${result.period}\n` +
    `Greeting:        ${result.greetingWord}`,
    "color: #d4af37; font-weight: 600;"
  );
}

export interface UseTimeDetectorState {
  isReady: boolean;
  timeInfo: TimeDetectionResult | null;
  greetingWord: string;
  dateStr: string;
  period: DayPeriod | null;
}

/**
 * React hook providing the single source of truth for the Main Page greeting.
 *
 * Guaranteed Properties:
 * - SSR Safe: Does not compute greeting during SSR, eliminating hydration mismatches.
 * - Zero Bad Fallback: Starts with empty greetingWord, NEVER "Good evening".
 * - Browser Local Clock: Immediately detects user's system time upon mount.
 * - Dynamic Real-Time Updates: Re-evaluates periodically to catch period transitions.
 */
export function useTimeDetector(): UseTimeDetectorState {
  const [state, setState] = useState<UseTimeDetectorState>({
    isReady: false,
    timeInfo: null,
    greetingWord: "",
    dateStr: "",
    period: null,
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const detected = detectTime(now);

      const formattedDate = now
        .toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();

      setState({
        isReady: true,
        timeInfo: detected,
        greetingWord: detected.greetingWord,
        dateStr: formattedDate,
        period: detected.period,
      });

      logTimeDiagnostics(detected);
    };

    // Execute immediately upon browser mount
    updateTime();

    // Lightweight timer checking every 15 seconds to update greeting across period boundaries
    const timer = setInterval(updateTime, 15000);
    return () => clearInterval(timer);
  }, []);

  return state;
}
