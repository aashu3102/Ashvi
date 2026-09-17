import {
  MAX_SENTENCE_LENGTH,
  MIN_SENTENCE_LENGTH,
} from "./VoiceConfig.js";

export interface SentenceChunk {
  index: number;
  text: string;
  isLast: boolean;
}

export class VoiceStreamService {
  /**
   * Common abbreviations that should NOT trigger a sentence split
   */
  private readonly abbreviationRegex = /\b(e\.g|i\.e|dr|mr|ms|mrs|prof|vs|etc|fig|approx|dept)\.$/i;

  /**
   * Splits a complete text into grammatical sentence segments.
   */
  splitIntoSentences(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const sentences: string[] = [];
    let current = "";

    // Split on sentence punctuation followed by space or newline, or Devanagari danda (।)
    const tokens = trimmed.split(/(?<=[.?!।;\n])\s+/);

    for (const token of tokens) {
      if (!token) continue;
      if (current.length > 0) {
        current += " " + token;
      } else {
        current = token;
      }

      // Check if current looks like an abbreviation
      if (this.abbreviationRegex.test(current)) {
        continue;
      }

      // If current is long enough or has reached boundary
      if (current.length >= MIN_SENTENCE_LENGTH || /[.?!।]$/.test(current)) {
        if (current.length > MAX_SENTENCE_LENGTH) {
          // Split large clause on comma or semicolon if possible
          const subclauses = current.split(/(?<=[,;:])\s+/);
          let subAccum = "";
          for (const clause of subclauses) {
            if ((subAccum + " " + clause).length > MAX_SENTENCE_LENGTH && subAccum.length > 0) {
              sentences.push(subAccum.trim());
              subAccum = clause;
            } else {
              subAccum = subAccum ? subAccum + " " + clause : clause;
            }
          }
          if (subAccum.trim()) sentences.push(subAccum.trim());
        } else {
          sentences.push(current.trim());
        }
        current = "";
      }
    }

    if (current.trim()) {
      sentences.push(current.trim());
    }

    return sentences.filter((s) => s.length > 0);
  }

  /**
   * Sentence chunker for streaming token generators.
   * Emits complete sentences as soon as they are formed.
   */
  async *processTokenStream(tokenStream: AsyncIterable<string>): AsyncGenerator<SentenceChunk> {
    let buffer = "";
    let sentenceIndex = 0;

    for await (const token of tokenStream) {
      buffer += token;

      // Look for sentence termination in buffer
      const match = buffer.match(/([.?!।\n])(\s+|$)/);
      if (match && match.index !== undefined) {
        const potentialEnd = match.index + 1;
        const candidate = buffer.slice(0, potentialEnd).trim();

        // Ensure not an abbreviation like "e.g."
        if (!this.abbreviationRegex.test(candidate)) {
          if (candidate.length >= 3 || buffer.length > MAX_SENTENCE_LENGTH) {
            yield {
              index: sentenceIndex++,
              text: candidate,
              isLast: false,
            };
            buffer = buffer.slice(potentialEnd).trimStart();
          }
        }
      }
    }

    // Flush remaining buffer
    const remaining = buffer.trim();
    if (remaining.length > 0) {
      yield {
        index: sentenceIndex,
        text: remaining,
        isLast: true,
      };
    }
  }
}
