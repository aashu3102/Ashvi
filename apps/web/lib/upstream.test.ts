import { describe, expect, it } from "vitest";
import { isLoopbackHostname, resolveUpstreamBase, rewriteUpstreamCookie, UpstreamConfigError } from "./upstream";

describe("production upstream resolution", () => {
  it("never uses localhost when running on Vercel", () => {
    expect(() => resolveUpstreamBase({ VERCEL: "1" })).toThrow(UpstreamConfigError);
    expect(() => resolveUpstreamBase({ VERCEL: "1", ASHVI_API_URL: "http://127.0.0.1:4000" })).toThrow(UpstreamConfigError);
    expect(() => resolveUpstreamBase({ VERCEL: "1", NEXT_PUBLIC_ASHVI_API_URL: "https://dead.trycloudflare.com" })).toThrow(UpstreamConfigError);
    expect(resolveUpstreamBase({ VERCEL: "1", ASHVI_API_URL: "https://ashvi-api.example.workers.dev/" })).toBe("https://ashvi-api.example.workers.dev");
  });

  it("defaults to local secure core off Vercel", () => {
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(resolveUpstreamBase({})).toBe("http://127.0.0.1:4000");
    expect(resolveUpstreamBase({ ASHVI_API_URL: "http://127.0.0.1:4000" })).toBe("http://127.0.0.1:4000");
  });
});

describe("first-party session cookies", () => {
  it("rewrites upstream cookies onto the Vercel frontend origin", () => {
    const rewritten = rewriteUpstreamCookie(
      "ashvi_session=abc; Domain=api.trycloudflare.com; Path=/api; SameSite=None; Secure",
      true,
    );
    expect(rewritten).toContain("ashvi_session=abc");
    expect(rewritten.toLowerCase()).toContain("samesite=lax");
    expect(rewritten.toLowerCase()).toContain("httponly");
    expect(rewritten.toLowerCase()).toContain("secure");
    expect(rewritten.toLowerCase()).not.toContain("domain=");
    expect(rewritten.toLowerCase()).toContain("path=/");
  });
});
