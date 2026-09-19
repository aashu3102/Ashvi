import type { EmbeddingProvider } from "../types.js";
import { LocalEmbeddingProvider } from "./local.embedding.js";

export interface EmbeddingConfig {
  provider?: "local";
  dimensions?: number;
}

export function createEmbeddingProvider(config: EmbeddingConfig = {}): EmbeddingProvider {
  // Default to local deterministic provider
  return new LocalEmbeddingProvider(config.dimensions ?? 384);
}
