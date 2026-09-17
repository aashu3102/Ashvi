import type { EmbeddingProvider } from "../types.js";
import { LocalEmbeddingProvider } from "./local.embedding.js";
import { OllamaEmbeddingProvider } from "./ollama.embedding.js";

export interface EmbeddingConfig {
  provider?: "local" | "ollama";
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  dimensions?: number;
}

export function createEmbeddingProvider(config: EmbeddingConfig = {}): EmbeddingProvider {
  if (config.provider === "ollama") {
    return new OllamaEmbeddingProvider({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      dimensions: config.dimensions ?? 2048,
    });
  }

  // Default to local deterministic provider
  return new LocalEmbeddingProvider(config.dimensions ?? 384);
}
