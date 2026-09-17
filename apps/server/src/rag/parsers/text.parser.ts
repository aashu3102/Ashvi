import type { DocumentParser } from "./parser.interface.js";
import type { ParseResult, ParsedSection } from "../types.js";

export class TextParser implements DocumentParser {
  supports(extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === ".txt" || ext === ".md";
  }

  async parse(buffer: Buffer): Promise<ParseResult> {
    const text = buffer.toString("utf8");
    const sections: ParsedSection[] = [];

    // Check if markdown headings are present
    const headingMatches = [...text.matchAll(/^(#{1,4})\s+(.+)$/gm)];

    if (headingMatches.length > 0) {
      // Structure-aware splitting by markdown headings
      const lines = text.split(/\r?\n/);
      let currentHeading = "Introduction";
      let currentLines: string[] = [];
      let lineStart = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);

        if (headingMatch) {
          if (currentLines.length > 0 && currentLines.some((l) => l.trim().length > 0)) {
            sections.push({
              content: currentLines.join("\n").trim(),
              sectionHeading: currentHeading,
              lineStart,
              lineEnd: i,
            });
            currentLines = [];
          }
          currentHeading = headingMatch[2].trim();
          lineStart = i + 1;
        }
        currentLines.push(line);
      }

      if (currentLines.length > 0 && currentLines.some((l) => l.trim().length > 0)) {
        sections.push({
          content: currentLines.join("\n").trim(),
          sectionHeading: currentHeading,
          lineStart,
          lineEnd: lines.length,
        });
      }
    } else {
      // Plain text: split by double line breaks into paragraphs
      const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
      let currentLine = 1;

      for (const p of paragraphs) {
        const lineCount = p.split(/\r?\n/).length;
        sections.push({
          content: p.trim(),
          sectionHeading: "Paragraph",
          lineStart: currentLine,
          lineEnd: currentLine + lineCount - 1,
        });
        currentLine += lineCount + 1;
      }
    }

    return {
      sections: sections.length > 0 ? sections : [{ content: text.trim(), sectionHeading: "Content" }],
      metadata: {
        totalCharacters: text.length,
        lineCount: text.split(/\r?\n/).length,
      },
    };
  }
}
