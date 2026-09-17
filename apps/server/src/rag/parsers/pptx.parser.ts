import AdmZip from "adm-zip";
import type { DocumentParser } from "./parser.interface.js";
import type { ParseResult, ParsedSection } from "../types.js";

export class PptxParser implements DocumentParser {
  supports(extension: string): boolean {
    return extension.toLowerCase() === ".pptx";
  }

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch (err) {
      throw new Error(`Failed to read PPTX archive "${filename}": ${err instanceof Error ? err.message : String(err)}`);
    }

    const zipEntries = zip.getEntries();
    // Filter and sort slide entries: ppt/slides/slide1.xml, slide2.xml...
    const slideEntries = zipEntries
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.match(/\d+/)![0], 10);
        const numB = parseInt(b.entryName.match(/\d+/)![0], 10);
        return numA - numB;
      });

    const sections: ParsedSection[] = [];

    for (const entry of slideEntries) {
      const slideXml = entry.getData().toString("utf8");
      const slideNum = parseInt(entry.entryName.match(/\d+/)![0], 10);

      // Extract text content inside <a:t> elements
      const textMatches = [...slideXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)].map((m) => m[1].trim()).filter(Boolean);

      if (textMatches.length === 0) continue;

      // The first line is typically the slide title
      const title = textMatches[0];
      const body = textMatches.slice(1).join("\n");
      const fullSlideContent = body ? `${title}\n${body}` : title;

      sections.push({
        content: fullSlideContent,
        slideNumber: slideNum,
        sectionHeading: `Slide ${slideNum}: ${title}`,
      });
    }

    return {
      sections,
      metadata: {
        slideCount: slideEntries.length,
      },
      pageCount: slideEntries.length,
    };
  }
}
