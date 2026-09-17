import {
  determinePeriod,
  periodToGreeting,
  DayPeriod,
} from "./time-detector";

export type TimeOfDay = DayPeriod;

export interface TimeTheme {
  timeOfDay: TimeOfDay;
  label: string;
  imageSrc: string;
  glowColor: string;
}

export const TIME_THEMES: Record<TimeOfDay, TimeTheme> = {
  morning: {
    timeOfDay: "morning",
    label: "Morning",
    imageSrc: "/ashvi/chat-morning.png",
    glowColor: "rgba(234, 179, 8, 0.12)",
  },
  afternoon: {
    timeOfDay: "afternoon",
    label: "Afternoon",
    imageSrc: "/ashvi/chat-afternoon.png",
    glowColor: "rgba(56, 189, 248, 0.12)",
  },
  evening: {
    timeOfDay: "evening",
    label: "Evening",
    imageSrc: "/ashvi/chat-evening.png",
    glowColor: "rgba(249, 115, 22, 0.14)",
  },
  night: {
    timeOfDay: "night",
    label: "Night",
    imageSrc: "/ashvi/chat-night.png",
    glowColor: "rgba(139, 92, 246, 0.14)",
  },
};

/**
 * Returns current time of day according to client's local hour:
 * Unified delegation to determinePeriod in time-detector.
 */
export function getTimeOfDayFromHour(hour: number): TimeOfDay {
  return determinePeriod(hour);
}

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  return determinePeriod(date.getHours());
}

export function getGreetingWord(timeOfDay: TimeOfDay): string {
  return periodToGreeting(timeOfDay);
}

export function getGreetingWordFromHour(hour: number): string {
  return periodToGreeting(determinePeriod(hour));
}

/**
 * Directly queries current browser/device local clock hour (new Date().getHours()).
 * Guaranteed client-side evaluation without UTC or server timezone artifacts.
 */
export function getLocalGreetingWord(): string {
  return periodToGreeting(determinePeriod(new Date().getHours()));
}

/**
 * Produces personalized greeting, e.g.:
 * "Good morning, Aashu." or "Good night, Shambhavi."
 */
export function getGreeting(timeOfDay: TimeOfDay, name?: string | null): string {
  const greetingWord = periodToGreeting(timeOfDay);
  const cleanName = name ? name.trim().split(" ")[0] : "";
  if (cleanName) {
    return `${greetingWord}, ${cleanName}.`;
  }
  return `${greetingWord}.`;
}
