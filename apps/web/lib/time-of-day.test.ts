import { describe, expect, it } from "vitest";
import {
  getTimeOfDayFromHour,
  getGreetingWordFromHour,
  getGreeting,
  TIME_THEMES,
  chatBackgrounds,
} from "./time-of-day";

describe("Time of day and greeting logic", () => {
  it("maps 05:00 - 11:59 to morning -> 'Good morning'", () => {
    for (let h = 5; h < 12; h++) {
      expect(getTimeOfDayFromHour(h)).toBe("morning");
      expect(getGreetingWordFromHour(h)).toBe("Good morning");
    }
  });

  it("maps 12:00 - 16:59 to afternoon -> 'Good afternoon'", () => {
    for (let h = 12; h < 17; h++) {
      expect(getTimeOfDayFromHour(h)).toBe("afternoon");
      expect(getGreetingWordFromHour(h)).toBe("Good afternoon");
    }
  });

  it("maps 17:00 - 20:59 to evening -> 'Good evening'", () => {
    for (let h = 17; h < 21; h++) {
      expect(getTimeOfDayFromHour(h)).toBe("evening");
      expect(getGreetingWordFromHour(h)).toBe("Good evening");
    }
  });

  it("maps 21:00 - 04:59 to night -> 'Good night'", () => {
    const nightHours = [21, 22, 23, 0, 1, 2, 3, 4];
    for (const h of nightHours) {
      expect(getTimeOfDayFromHour(h)).toBe("night");
      expect(getGreetingWordFromHour(h)).toBe("Good night");
    }
  });

  it("formats dynamic greetings correctly for authenticated users", () => {
    expect(getGreeting("morning", "Aashu")).toBe("Good morning, Aashu.");
    expect(getGreeting("morning", "Shambhavi")).toBe("Good morning, Shambhavi.");

    expect(getGreeting("afternoon", "Aashu")).toBe("Good afternoon, Aashu.");
    expect(getGreeting("afternoon", "Shambhavi")).toBe("Good afternoon, Shambhavi.");

    expect(getGreeting("evening", "Aashu")).toBe("Good evening, Aashu.");
    expect(getGreeting("evening", "Shambhavi")).toBe("Good evening, Shambhavi.");

    expect(getGreeting("night", "Aashu")).toBe("Good night, Aashu.");
    expect(getGreeting("night", "Shambhavi")).toBe("Good night, Shambhavi.");
  });

  it("handles full names by extracting first name cleanly", () => {
    expect(getGreeting("morning", "Aashu Singh")).toBe("Good morning, Aashu.");
    expect(getGreeting("night", "Shambhavi Sharma")).toBe("Good night, Shambhavi.");
  });

  it("maps each time period to the new 4 public background assets", () => {
    expect(TIME_THEMES.morning.imageSrc).toContain("01_06_23%20AM.png");
    expect(TIME_THEMES.afternoon.imageSrc).toContain("01_06_29%20AM.png");
    expect(TIME_THEMES.evening.imageSrc).toContain("01_06_36%20AM.png");
    expect(TIME_THEMES.night.imageSrc).toContain("01_06_18%20AM.png");

    expect(chatBackgrounds.morning).toBe(TIME_THEMES.morning.imageSrc);
    expect(chatBackgrounds.afternoon).toBe(TIME_THEMES.afternoon.imageSrc);
    expect(chatBackgrounds.evening).toBe(TIME_THEMES.evening.imageSrc);
    expect(chatBackgrounds.night).toBe(TIME_THEMES.night.imageSrc);

    // Verify obsolete paths are not referenced
    for (const period of ["morning", "afternoon", "evening", "night"] as const) {
      expect(TIME_THEMES[period].imageSrc).not.toContain("/ashvi/chat-");
    }
  });
});
