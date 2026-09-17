import type { ParsedSection } from "./types.js";

const HEADER_FOOTER_PATTERNS = [
  /^Page\s+\d+(\s+of\s+\d+)?$/i,
  /^\d+\s*\/\s*\d+$/,
  /^Confidential\s*-\s*Internal\s*Use\s*Only$/i,
  /^All\s+Rights\s+Reserved\.?$/i,
];

export class TextNormalizer {
  normalizeText(text: string, preserveFormatting = false): string {
    if (!text) return "";

    // 1. Remove null bytes and non-printable control characters (keep \n and \t)
    let cleaned = text
      .replace(/\0/g, "")
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\uFFFD/g, ""); // Unicode replacement char

    // 2. Normalize line endings to \n
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // 3. Remove repeated headers / footers per line
    const lines = cleaned.split("\n");
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !HEADER_FOOTER_PATTERNS.some((pattern) => pattern.test(trimmed));
    });

    cleaned = filteredLines.join("\n");

    if (!preserveFormatting) {
      // 4. Collapse runs of spaces (not newlines)
      cleaned = cleaned.replace(/[^\S\r\n]+/g, " ");

      // 5. Trim individual lines
      cleaned = cleaned
        .split("\n")
        .map((l) => l.trim())
        .join("\n");

      // 6. Collapse 3+ consecutive newlines to double newline (\n\n)
      cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
    }

    return cleaned.trim();
  }

  normalizeSections(sections: ParsedSection[]): ParsedSection[] {
    const normalizedSections: ParsedSection[] = [];

    for (const section of sections) {
      const isCode = section.content.startsWith("```");
      const normalizedContent = this.normalizeText(section.content, isCode);

      if (!normalizedContent) continue; // Drop empty sections / pages

      normalizedSections.push({
        ...section,
        content: normalizedContent,
        sectionHeading: section.sectionHeading
          ? this.normalizeText(section.sectionHeading)
          : undefined,
      });
    }

    return normalizedSections;
  }
}
