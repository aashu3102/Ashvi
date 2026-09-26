import { describe, expect, it } from "vitest";
import {
  DuckDuckGoSearchProvider,
  TavilySearchProvider,
  WebSearchService,
} from "../src/tools/search.tool.js";

describe("WebSearchService and Providers", () => {
  it("DuckDuckGoSearchProvider is available and handles empty queries gracefully", async () => {
    const provider = new DuckDuckGoSearchProvider();
    expect(await provider.isAvailable()).toBe(true);
    expect(await provider.search("")).toEqual([]);
    expect(await provider.search("   ")).toEqual([]);
  });

  it("TavilySearchProvider is only available when API key is provided", async () => {
    const withoutKey = new TavilySearchProvider("");
    expect(await withoutKey.isAvailable()).toBe(false);
    expect(await withoutKey.search("test")).toEqual([]);

    const withKey = new TavilySearchProvider("tvly-test-key");
    expect(await withKey.isAvailable()).toBe(true);
  });

  it("WebSearchService handles disabled state correctly", async () => {
    const service = new WebSearchService({ enabled: false });
    expect(await service.isAvailable()).toBe(false);

    const result = await service.search("what is quantum computing");
    expect(result.searchUsed).toBe(false);
    expect(result.results).toEqual([]);
  });

  it("WebSearchService formats context cleanly with citations", () => {
    const service = new WebSearchService();
    const formatted = service.formatContext([
      {
        title: "Test Title 1",
        url: "https://example.com/1",
        snippet: "This is test snippet 1",
      },
      {
        title: "Test Title 2",
        url: "https://example.com/2",
        snippet: "This is test snippet 2",
      },
    ]);

    expect(formatted).toContain("WEB RESEARCH RESULTS:");
    expect(formatted).toContain("[1] Title: Test Title 1");
    expect(formatted).toContain("URL: https://example.com/1");
    expect(formatted).toContain("Snippet: This is test snippet 1");
    expect(formatted).toContain("[2] Title: Test Title 2");
  });

  it("WebSearchService returns empty string when formatting empty results", () => {
    const service = new WebSearchService();
    expect(service.formatContext([])).toBe("");
  });
});
