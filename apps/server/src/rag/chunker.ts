import type { DocumentChunkData, ParsedSection } from "./types.js";

export interface ChunkerConfig {
  chunkSize?: number; // target words per chunk (default: 350)
  chunkOverlap?: number; // overlap words (default: 50)
  minChunkSize?: number; // minimum words for a valid chunk (default: 20)
  maxChunkSize?: number; // maximum allowed words (default: 800)
}

export class DocumentChunker {
  private chunkSize: number;
  private chunkOverlap: number;
  private minChunkSize: number;
  private maxChunkSize: number;

  constructor(config: ChunkerConfig = {}) {
    this.chunkSize = config.chunkSize ?? 350;
    this.chunkOverlap = config.chunkOverlap ?? 50;
    this.minChunkSize = config.minChunkSize ?? 20;
    this.maxChunkSize = config.maxChunkSize ?? 800;
  }

  estimateTokenCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  chunkSections(sections: ParsedSection[]): DocumentChunkData[] {
    const chunks: DocumentChunkData[] = [];
    let globalChunkIndex = 0;

    for (const section of sections) {
      const words = section.content.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      // If the section is reasonably sized, keep it as an atomic chunk
      if (words.length <= this.chunkSize) {
        chunks.push({
          chunkIndex: globalChunkIndex++,
          content: section.content.trim(),
          tokenCount: words.length,
          pageNumber: section.pageNumber,
          sectionHeading: section.sectionHeading,
          slideNumber: section.slideNumber,
          sheetName: section.sheetName,
          lineStart: section.lineStart,
          lineEnd: section.lineEnd,
        });
        continue;
      }

      // Section is large: split into overlapping sub-chunks respecting sentence boundaries where possible
      let start = 0;
      while (start < words.length) {
        let end = Math.min(start + this.chunkSize, words.length);

        // If not at the very end, try to find a natural sentence boundary in the last 25% of the window
        if (end < words.length) {
          const searchStartIndex = Math.max(start + Math.floor(this.chunkSize * 0.75), start);
          let naturalBreak = -1;
          for (let i = end - 1; i >= searchStartIndex; i--) {
            if (/[.!?]$/.test(words[i]) || words[i].includes("\n")) {
              naturalBreak = i + 1;
              break;
            }
          }
          if (naturalBreak > start) {
            end = naturalBreak;
          }
        }

        const chunkWords = words.slice(start, end);
        const content = chunkWords.join(" ");

        if (chunkWords.length >= this.minChunkSize || end === words.length) {
          chunks.push({
            chunkIndex: globalChunkIndex++,
            content,
            tokenCount: chunkWords.length,
            pageNumber: section.pageNumber,
            sectionHeading: section.sectionHeading,
            slideNumber: section.slideNumber,
            sheetName: section.sheetName,
            lineStart: section.lineStart,
            lineEnd: section.lineEnd,
          });
        }

        if (end === words.length) break;
        start = Math.max(end - this.chunkOverlap, start + 1);
      }
    }

    return chunks;
  }
}
