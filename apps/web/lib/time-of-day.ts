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
 * - 05:00 – 11:59: Morning   -> "Good morning"
 * - 12:00 – 16:59: Afternoon -> "Good afternoon"
 * - 17:00 – 20:59: Evening   -> "Good evening"
 * - 21:00 – 04:59: Night     -> "Good night"
 */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
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

export function getGreetingWord(timeOfDay: TimeOfDay): string {
  switch (timeOfDay) {
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
 * Produces personalized greeting, e.g.:
 * "Good morning, Aashu." or "Good night, Shambhavi."
 */
export function getGreeting(timeOfDay: TimeOfDay, name?: string | null): string {
  const greetingWord = getGreetingWord(timeOfDay);
  const cleanName = name ? name.trim().split(" ")[0] : "";
  if (cleanName) {
    return `${greetingWord}, ${cleanName}.`;
  }
  return `${greetingWord}.`;
}
