import type { EmbeddingProvider } from "../types.js";

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = "ollama";
  readonly dimensions: number;
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor(options: { baseUrl?: string; model?: string; dimensions?: number; timeoutMs?: number } = {}) {
    this.baseUrl = (options.baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
    this.model = options.model || "qwen2.5:3b";
    this.dimensions = options.dimensions || 2048;
    this.timeoutMs = options.timeoutMs || 15000;
  }

  async embedText(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Ollama embedding error HTTP ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as { embedding?: number[]; error?: string };
      if (data.error) {
        throw new Error(`Ollama returned embedding error: ${data.error}`);
      }

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error("Ollama returned a malformed embedding response.");
      }

      return data.embedding;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Ollama embedding timed out after ${this.timeoutMs}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    // Sequential/batched execution to avoid overwhelming the local model runner
    for (const text of texts) {
      results.push(await this.embedText(text));
    }
    return results;
  }
}
