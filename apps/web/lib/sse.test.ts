import { describe, expect, it } from "vitest";
import { parseAshviSseLine } from "./sse";

describe("Ashvi SSE parsing", () => {
  it("parses non-empty chunks and completion events", () => {
    expect(parseAshviSseLine('data: {"type":"chunk","content":"Hello"}')).toEqual({ type: "chunk", content: "Hello" });
    expect(parseAshviSseLine('data: {"type":"done","assistant":{"id":"1","role":"ASSISTANT","content":"Hello"}}')).toMatchObject({ type: "done", assistant: { content: "Hello" } });
  });

  it("turns malformed events into an explicit error", () => {
    expect(parseAshviSseLine("data: not-json")).toMatchObject({ type: "error" });
    expect(parseAshviSseLine("chunk")).toBeNull();
  });
});