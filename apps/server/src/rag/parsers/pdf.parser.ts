import type { DocumentParser } from "./parser.interface.js";
import type { ParseResult, ParsedSection } from "../types.js";

export class PdfParser implements DocumentParser {
  supports(extension: string): boolean {
    return extension.toLowerCase() === ".pdf";
  }

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    // @ts-expect-error - direct submodule import bypasses index.js CLI debug runner
    const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = pdfParseModule.default || pdfParseModule;
    let rawText = "";
    let numPages = 1;
    let title = filename;
    let author: string | undefined;
    let producer: string | undefined;

    try {
      const result = await pdfParse(buffer);
      numPages = result.numpages || 1;
      rawText = result.text || "";
      title = result.info?.Title || filename;
      author = result.info?.Author;
      producer = result.info?.Producer;
    } catch (err) {
      // Fallback extraction for uncompressed text streams in PDFs
      const rawStr = buffer.toString("latin1");
      const textMatches = [...rawStr.matchAll(/\(([^)]+)\)\s*Tj/g)].map((m) => m[1]);
      if (textMatches.length > 0) {
        rawText = textMatches.join(" ");
        numPages = 1;
      } else {
        throw new Error(`Failed to parse PDF document "${filename}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Split pages by form-feed characters if present, otherwise approximate by page count
    const sections: ParsedSection[] = [];
    const rawPages = rawText.split(/\f+/).filter((p: string) => p.trim().length > 0);

    if (rawPages.length > 0) {
      for (let i = 0; i < rawPages.length; i++) {
        sections.push({
          content: rawPages[i].trim(),
          pageNumber: i + 1,
        });
      }
    } else if (rawText.trim().length > 0) {
      sections.push({
        content: rawText.trim(),
        pageNumber: 1,
      });
    }

    return {
      sections,
      metadata: {
        pageCount: numPages,
        title,
        author,
        producer,
      },
      pageCount: numPages,
    };
  }
}
