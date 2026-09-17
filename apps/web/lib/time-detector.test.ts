import { describe, expect, it } from "vitest";
import {
  determinePeriod,
  periodToGreeting,
  detectTime,
  detectSystemTimezone,
  getIndiaReferenceTime,
} from "./time-detector";

describe("Ashvi Centralized Time Detector", () => {
  describe("Exact Period Boundaries", () => {
    it("04:59 -> night ('Good night')", () => {
      const period = determinePeriod(4, 59);
      expect(period).toBe("night");
      expect(periodToGreeting(period)).toBe("Good night");
    });

    it("05:00 -> morning ('Good morning')", () => {
      const period = determinePeriod(5, 0);
      expect(period).toBe("morning");
      expect(periodToGreeting(period)).toBe("Good morning");
    });

    it("11:59 -> morning ('Good morning')", () => {
      const period = determinePeriod(11, 59);
      expect(period).toBe("morning");
      expect(periodToGreeting(period)).toBe("Good morning");
    });

    it("12:00 -> afternoon ('Good afternoon')", () => {
      const period = determinePeriod(12, 0);
      expect(period).toBe("afternoon");
      expect(periodToGreeting(period)).toBe("Good afternoon");
    });

    it("16:59 -> afternoon ('Good afternoon')", () => {
      const period = determinePeriod(16, 59);
      expect(period).toBe("afternoon");
      expect(periodToGreeting(period)).toBe("Good afternoon");
    });

    it("17:00 -> evening ('Good evening')", () => {
      const period = determinePeriod(17, 0);
      expect(period).toBe("evening");
      expect(periodToGreeting(period)).toBe("Good evening");
    });

    it("20:59 -> evening ('Good evening')", () => {
      const period = determinePeriod(20, 59);
      expect(period).toBe("evening");
      expect(periodToGreeting(period)).toBe("Good evening");
    });

    it("21:00 -> night ('Good night')", () => {
      const period = determinePeriod(21, 0);
      expect(period).toBe("night");
      expect(periodToGreeting(period)).toBe("Good night");
    });

    it("23:59 -> night ('Good night')", () => {
      const period = determinePeriod(23, 59);
      expect(period).toBe("night");
      expect(periodToGreeting(period)).toBe("Good night");
    });

    it("00:00 -> night ('Good night')", () => {
      const period = determinePeriod(0, 0);
      expect(period).toBe("night");
      expect(periodToGreeting(period)).toBe("Good night");
    });
  });

  describe("Complete 24-Hour Coverage", () => {
    it("maps every hour 0..23 accurately without gaps", () => {
      const morningHours = [5, 6, 7, 8, 9, 10, 11];
      const afternoonHours = [12, 13, 14, 15, 16];
      const eveningHours = [17, 18, 19, 20];
      const nightHours = [21, 22, 23, 0, 1, 2, 3, 4];

      for (const h of morningHours) {
        expect(determinePeriod(h)).toBe("morning");
        expect(periodToGreeting(determinePeriod(h))).toBe("Good morning");
      }
      for (const h of afternoonHours) {
        expect(determinePeriod(h)).toBe("afternoon");
        expect(periodToGreeting(determinePeriod(h))).toBe("Good afternoon");
      }
      for (const h of eveningHours) {
        expect(determinePeriod(h)).toBe("evening");
        expect(periodToGreeting(determinePeriod(h))).toBe("Good evening");
      }
      for (const h of nightHours) {
        expect(determinePeriod(h)).toBe("night");
        expect(periodToGreeting(determinePeriod(h))).toBe("Good night");
      }
    });
  });

  describe("System Local Time Method Enforcement (getUTCHours() is NOT used)", () => {
    it("strictly follows system local getHours() and ignores UTC differences", () => {
      // Create a mock Date where local hour is 2 AM (night)
      const mockDate = new Date();
      // Ensure we test whatever local getHours() returns
      const localHour = mockDate.getHours();
      const result = detectTime(mockDate);

      expect(result.systemHour).toBe(localHour);
      expect(result.period).toBe(determinePeriod(localHour, mockDate.getMinutes()));
      expect(result.greetingWord).toBe(periodToGreeting(result.period));
    });
  });

  describe("System Timezone and India Reference Clock", () => {
    it("detects system timezone via Intl", () => {
      const tz = detectSystemTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });

    it("calculates India reference time using official IANA Asia/Kolkata", () => {
      const india = getIndiaReferenceTime(new Date());
      expect(india.timezone).toBe("Asia/Kolkata");
      expect(typeof india.formatted).toBe("string");
      expect(india.hour).toBeGreaterThanOrEqual(0);
      expect(india.hour).toBeLessThanOrEqual(23);
      expect(india.minute).toBeGreaterThanOrEqual(0);
      expect(india.minute).toBeLessThanOrEqual(59);
    });

    it("prints live detection diagnostics", () => {
      const result = detectTime();
      console.log("LIVE DETECTED TIME:", {
        systemTime: result.systemTimeFormatted,
        systemTimezone: result.systemTimezone,
        systemHour: result.systemHour,
        systemMinute: result.systemMinute,
        indiaTime: result.indiaTimeFormatted,
        indiaTimezone: result.indiaTimezone,
        period: result.period,
        greetingWord: result.greetingWord,
      });
      expect(result.greetingWord).toBeDefined();
    });

    it("evaluates detectTime accurately for morning, afternoon, evening, night dates", () => {
      // Create dates with specific local hours
      const dMorning = new Date(2026, 8, 18, 8, 30, 0); // 08:30 AM
      const dAfternoon = new Date(2026, 8, 18, 14, 15, 0); // 02:15 PM
      const dEvening = new Date(2026, 8, 18, 18, 45, 0); // 06:45 PM
      const dNight = new Date(2026, 8, 18, 22, 10, 0); // 10:10 PM

      expect(detectTime(dMorning).greetingWord).toBe("Good morning");
      expect(detectTime(dMorning).period).toBe("morning");

      expect(detectTime(dAfternoon).greetingWord).toBe("Good afternoon");
      expect(detectTime(dAfternoon).period).toBe("afternoon");

      expect(detectTime(dEvening).greetingWord).toBe("Good evening");
      expect(detectTime(dEvening).period).toBe("evening");

      expect(detectTime(dNight).greetingWord).toBe("Good night");
      expect(detectTime(dNight).period).toBe("night");
    });
  });
});
