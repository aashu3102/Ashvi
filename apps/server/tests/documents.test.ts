import { describe, expect, it } from "vitest";
import { createChunks } from "../src/services/document.service.js";

describe("document chunking", () => {
  it("creates ordered overlapping chunks for searchable context", () => {
    const words = Array.from({ length: 430 }, (_, index) => `word${index}`);
    const chunks = createChunks(words.join(" "));

    expect(chunks).toHaveLength(3);
    expect(chunks[0].split(" ")).toHaveLength(220);
    expect(chunks[1].split(" ").slice(0, 35)).toEqual(chunks[0].split(" ").slice(-35));
    expect(chunks.join(" ")).toContain("word429");
  });
});