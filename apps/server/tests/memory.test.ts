import { describe, expect, it } from "vitest";
import { suggestMemory } from "../src/services/memory.service.js";

describe("memory suggestions", () => {
  it("suggests a preference when the user states one", () => {
    expect(suggestMemory("I prefer concise answers with actions first.")).toMatchObject({
      category: "PREFERENCE",
      source: "USER",
      importance: 4,
    });
  });

  it("does not suggest ordinary conversational messages", () => {
    expect(suggestMemory("What is the weather today?")).toBeNull();
  });
});