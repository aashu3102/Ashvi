import { describe, expect, it } from "vitest";
import { verifyAnswer } from "../src/services/verification.service.js";

describe("verification service", () => {
  it("flags uncertain or fabricated-looking answers", () => {
    const result = verifyAnswer("I am completely sure this file says exact content from memory without checking.");

    expect(result.needsVerification).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("accepts answers that are appropriately cautious", () => {
    const result = verifyAnswer("I can confirm I reviewed the file and the result appears consistent with the available evidence.");

    expect(result.needsVerification).toBe(false);
    expect(result.confidence).toBe("high");
  });

  it("requires a source citation when document evidence was retrieved", () => {
    const result = verifyAnswer("The launch date is March 12.", "[Source: launch-plan.md, section 1]\nLaunch date: March 12.");

    expect(result.needsVerification).toBe(true);
    expect(result.sourceFiles).toEqual(["launch-plan.md"]);
  });

  it("accepts an answer that cites the retrieved source", () => {
    const result = verifyAnswer("According to launch-plan.md, the launch date is March 12.", "[Source: launch-plan.md, section 1]\nLaunch date: March 12.");

    expect(result.needsVerification).toBe(false);
    expect(result.sourceFiles).toEqual(["launch-plan.md"]);
  });
});
