import type { DocumentParser } from "./parser.interface.js";
import type { ParseResult, ParsedSection } from "../types.js";

export class DocxParser implements DocumentParser {
  supports(extension: string): boolean {
    return extension.toLowerCase() === ".docx";
  }

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const mammoth = await import("mammoth");
    let rawResult;
    let htmlResult;

    try {
      [rawResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer }),
        mammoth.convertToHtml({ buffer }).catch(() => null),
      ]);
    } catch (err) {
      throw new Error(`Failed to parse DOCX document "${filename}": ${err instanceof Error ? err.message : String(err)}`);
    }

    const sections: ParsedSection[] = [];
    const html = htmlResult?.value || "";

    if (html) {
      // Structure-aware extraction using headings and paragraphs from HTML
      const elementRegex = /<(h[1-6]|p|table)[^>]*>([\s\S]*?)<\/\1>/gi;
      let match;
      let currentHeading = "Document Content";
      let currentSectionText: string[] = [];

      while ((match = elementRegex.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        const content = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (!content) continue;

        if (tag.startsWith("h")) {
          if (currentSectionText.length > 0) {
            sections.push({
              content: currentSectionText.join("\n\n"),
              sectionHeading: currentHeading,
            });
            currentSectionText = [];
          }
          currentHeading = content;
        } else {
          currentSectionText.push(content);
        }
      }

      if (currentSectionText.length > 0) {
        sections.push({
          content: currentSectionText.join("\n\n"),
          sectionHeading: currentHeading,
        });
      }
    }

    // Fallback to raw text paragraphs if html parsing yielded nothing
    if (sections.length === 0 && rawResult.value.trim()) {
      const paragraphs = rawResult.value.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
      for (const p of paragraphs) {
        sections.push({
          content: p.trim(),
          sectionHeading: "General",
        });
      }
    }

    return {
      sections,
      metadata: {
        totalCharacters: rawResult.value.length,
        messages: rawResult.messages,
      },
    };
  }
}
