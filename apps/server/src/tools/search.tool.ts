
export interface SearchOptions {
  maxResults?: number;
  timeoutMs?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

/**
 * Zero-config DuckDuckGo HTML search provider.
 * Extracts real organic search results without requiring external API keys.
 */
export class DuckDuckGoSearchProvider implements SearchProvider {
  readonly id = "duckduckgo";
  readonly name = "DuckDuckGo Web Search";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const maxResults = options.maxResults ?? 5;
    const timeoutMs = options.timeoutMs ?? 8000;
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        return [];
      }

      const html = await response.text();
      return this.parseHtmlResults(html, maxResults);
    } catch {
      return [];
    }
  }

  private parseHtmlResults(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];
    // Match DuckDuckGo result blocks
    const linkRegex = /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    const titleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    const titles: string[] = [];
    const urls: string[] = [];
    const snippets: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = titleRegex.exec(html)) !== null) {
      const cleanTitle = match[1].replace(/<[^>]+>/g, "").trim();
      if (cleanTitle) titles.push(cleanTitle);
    }

    while ((match = linkRegex.exec(html)) !== null) {
      let rawUrl = match[1].trim();
      // Decode DuckDuckGo redirect uddg parameter if present
      if (rawUrl.includes("uddg=")) {
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          try {
            rawUrl = decodeURIComponent(uddgMatch[1]);
          } catch {
            // Keep rawUrl
          }
        }
      }
      urls.push(rawUrl);
    }

    while ((match = snippetRegex.exec(html)) !== null) {
      const cleanSnippet = match[1].replace(/<[^>]+>/g, "").trim();
      snippets.push(cleanSnippet);
    }

    const count = Math.min(titles.length, urls.length, maxResults);
    for (let i = 0; i < count; i++) {
      if (urls[i] && urls[i].startsWith("http")) {
        results.push({
          title: titles[i] || `Source ${i + 1}`,
          url: urls[i],
          snippet: snippets[i] || "",
        });
      }
    }

    return results;
  }
}

/**
 * Tavily Search Provider (if TAVILY_API_KEY is configured).
 */
export class TavilySearchProvider implements SearchProvider {
  readonly id = "tavily";
  readonly name = "Tavily Search API";

  constructor(private readonly apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.apiKey) return [];
    const maxResults = options.maxResults ?? 5;
    const timeoutMs = options.timeoutMs ?? 8000;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          max_results: maxResults,
          include_snippets: true,
        }),
      });
      clearTimeout(timer);

      if (!response.ok) return [];

      const data = (await response.json()) as { results?: Array<{ title: string; url: string; content: string }> };
      if (!Array.isArray(data.results)) return [];

      return data.results.map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content,
      }));
    } catch {
      return [];
    }
  }
}

export interface WebSearchServiceConfig {
  enabled?: boolean;
  provider?: "duckduckgo" | "tavily" | "disabled";
  tavilyApiKey?: string;
  defaultMaxResults?: number;
  timeoutMs?: number;
}

export class WebSearchService {
  private provider: SearchProvider;
  private enabled: boolean;
  private defaultMaxResults: number;
  private timeoutMs: number;

  constructor(config: WebSearchServiceConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.defaultMaxResults = config.defaultMaxResults ?? 5;
    this.timeoutMs = config.timeoutMs ?? 8000;

    if (config.tavilyApiKey && config.tavilyApiKey.trim()) {
      this.provider = new TavilySearchProvider(config.tavilyApiKey.trim());
    } else {
      this.provider = new DuckDuckGoSearchProvider();
    }
  }

  setProvider(provider: SearchProvider) {
    this.provider = provider;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return false;
    return this.provider.isAvailable();
  }

  async search(query: string, options?: SearchOptions): Promise<{ results: SearchResult[]; searchUsed: boolean }> {
    if (!this.enabled || !query.trim()) {
      return { results: [], searchUsed: false };
    }

    try {
      const results = await this.provider.search(query, {
        maxResults: options?.maxResults ?? this.defaultMaxResults,
        timeoutMs: options?.timeoutMs ?? this.timeoutMs,
      });

      return {
        results,
        searchUsed: results.length > 0,
      };
    } catch {
      return { results: [], searchUsed: false };
    }
  }

  formatContext(results: SearchResult[]): string {
    if (results.length === 0) return "";

    const lines: string[] = ["WEB RESEARCH RESULTS:"];
    results.forEach((r, idx) => {
      lines.push(`[${idx + 1}] Title: ${r.title}`);
      lines.push(`URL: ${r.url}`);
      if (r.snippet) lines.push(`Snippet: ${r.snippet}`);
      lines.push("");
    });

    return lines.join("\n").trim();
  }
}
