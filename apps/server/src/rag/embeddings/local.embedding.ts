import type { EmbeddingProvider } from "../types.js";

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = "local-dense-projection";
  readonly dimensions: number;

  constructor(dimensions = 384) {
    this.dimensions = dimensions;
  }

  async embedText(text: string): Promise<number[]> {
    const vector = new Float64Array(this.dimensions);
    const normalized = text.toLowerCase().trim();

    if (!normalized) {
      return Array.from(vector);
    }

    // Extract word tokens and character 3-grams
    const tokens = normalized.split(/\W+/).filter((t) => t.length > 0);

    // 1. Word token projections
    for (const token of tokens) {
      const h1 = fnv1a(token) % this.dimensions;
      const h2 = fnv1a(`rev_${token}`) % this.dimensions;
      const sign = (fnv1a(`sgn_${token}`) % 2 === 0) ? 1.0 : -1.0;
      vector[h1] += sign * 1.5;
      vector[h2] += 0.8;
    }

    // 2. Character n-gram projections for subword robustness
    const n = 3;
    for (let i = 0; i <= normalized.length - n; i++) {
      const ngram = normalized.slice(i, i + n);
      const h = fnv1a(ngram) % this.dimensions;
      const sign = (fnv1a(`sgn_${ngram}`) % 2 === 0) ? 1.0 : -1.0;
      vector[h] += sign * 0.4;
    }

    // 3. L2 Unit Normalization
    let sumSq = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] = Number((vector[i] / norm).toFixed(6));
      }
    }

    return Array.from(vector);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }
}
