export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

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
 * - Morning:   05:00 – 10:59
 * - Afternoon: 11:00 – 15:59
 * - Evening:   16:00 – 18:59
 * - Night:     19:00 – 04:59
 */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) {
    return "morning";
  }
  if (hour >= 11 && hour < 16) {
    return "afternoon";
  }
  if (hour >= 16 && hour < 19) {
    return "evening";
  }
  return "night";
}

/**
 * Produces personalized greeting, e.g.:
 * "Good morning, Aashu." or "Good night, Shambhavi."
 */
export function getGreeting(timeOfDay: TimeOfDay, name?: string | null): string {
  const cleanName = name ? name.trim().split(" ")[0] : "";
  if (cleanName) {
    return `Good ${timeOfDay}, ${cleanName}.`;
  }
  return `Good ${timeOfDay}.`;
}
