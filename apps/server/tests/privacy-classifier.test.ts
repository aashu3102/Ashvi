import { describe, expect, it } from "vitest";
import {
  containsPrivateKeyword,
  isConversationPrivate,
  normalizePrivacyText,
  PRIVATE_KEYWORDS,
} from "../src/orchestrator/privacy-classifier.js";

describe("Privacy Classifier — Verification Suite", () => {
  it("exports valid PRIVATE_KEYWORDS list", () => {
    expect(Array.isArray(PRIVATE_KEYWORDS)).toBe(true);
    expect(PRIVATE_KEYWORDS.length).toBeGreaterThan(0);
  });

  // Test 1: Conversation containing "Barbie" becomes PRIVATE.
  it("Test 1: Conversation containing 'Barbie' becomes PRIVATE", () => {
    expect(containsPrivateKeyword("Hello Barbie")).toBe(true);
    expect(containsPrivateKeyword("I bought a Barbie doll today")).toBe(true);
    expect(isConversationPrivate([{ content: "I saw Barbie yesterday" }])).toBe(true);
  });

  // Test 2: Conversation containing "Shambhavi" becomes PRIVATE.
  it("Test 2: Conversation containing 'Shambhavi' becomes PRIVATE", () => {
    expect(containsPrivateKeyword("Shambhavi called me")).toBe(true);
    expect(containsPrivateKeyword("Meet with Shambhavi at 5pm")).toBe(true);
    expect(isConversationPrivate([{ content: "Let's plan for shambhavi's birthday" }])).toBe(true);
  });

  // Test 3: Conversation containing "meri gf" becomes PRIVATE.
  it("Test 3: Conversation containing 'meri gf' becomes PRIVATE", () => {
    expect(containsPrivateKeyword("meri gf se baat karni hai")).toBe(true);
    expect(containsPrivateKeyword("Tell me a poem for my gf")).toBe(true);
    expect(containsPrivateKeyword("She is my gf")).toBe(true);
    expect(isConversationPrivate([{ content: "aaj meri gf ka mood off hai" }])).toBe(true);
  });

  // Test 4: Conversation containing "meri bandi" becomes PRIVATE.
  it("Test 4: Conversation containing 'meri bandi' becomes PRIVATE", () => {
    expect(containsPrivateKeyword("meri bandi naraz hai")).toBe(true);
    expect(containsPrivateKeyword("bandi ka birthday aa raha hai")).toBe(true);
    expect(isConversationPrivate([{ content: "meri bandi ke liye surprise plan karo" }])).toBe(true);
  });

  // Test 5: Unicode / case variants (e.g. "b a r b i e", "BARBIE", "shambhavi") match correctly.
  it("Test 5: Unicode / case variants (e.g. 'b a r b i e', 'BARBIE', 'shambhavi') match correctly", () => {
    expect(containsPrivateKeyword("BARBIE")).toBe(true);
    expect(containsPrivateKeyword("b a r b i e")).toBe(true);
    expect(containsPrivateKeyword("B  A  R  B  I  E")).toBe(true);
    expect(containsPrivateKeyword("s h a m b h a v i")).toBe(true);
    expect(containsPrivateKeyword("SHAMBHAVI")).toBe(true);
    expect(containsPrivateKeyword("shambhavi")).toBe(true);
    expect(containsPrivateKeyword("g  f")).toBe(true);
    expect(containsPrivateKeyword("b  a  n  d  i")).toBe(true);
  });

  // Test 6: Normal message (e.g. "Explain photosynthesis") remains non-private.
  it("Test 6: Normal message (e.g. 'Explain photosynthesis') remains non-private", () => {
    expect(containsPrivateKeyword("Explain photosynthesis")).toBe(false);
    expect(containsPrivateKeyword("Write a TypeScript function to sort an array")).toBe(false);
    expect(containsPrivateKeyword("What is the capital of France?")).toBe(false);
    expect(
      isConversationPrivate([
        { content: "Explain photosynthesis" },
        { content: "How does chlorophyll capture sunlight?" },
      ])
    ).toBe(false);
  });

  it("normalizes text with NFKC and whitespace collapsing", () => {
    const raw = "  B\uFF41\uFF52\uFF42\uFF49\uFF45  "; // Fullwidth "Barbie"
    expect(normalizePrivacyText(raw)).toContain("barbie");
    expect(containsPrivateKeyword(raw)).toBe(true);
  });

  it("handles word boundaries properly so words like 'standby' or 'barbarian' don't falsely match unless intended", () => {
    expect(containsPrivateKeyword("Please stand by for updates")).toBe(false);
    expect(containsPrivateKeyword("The barbarian tribe was ancient")).toBe(false);
  });
});
