import { extname } from "node:path";
import type { DocumentParser } from "./parser.interface.js";
import type { ParseResult, ParsedSection } from "../types.js";

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".py": "Python",
  ".json": "JSON",
  ".sql": "SQL",
  ".html": "HTML",
  ".css": "CSS",
  ".c": "C",
  ".cpp": "C++",
  ".h": "C/C++ Header",
  ".java": "Java",
  ".go": "Go",
  ".rs": "Rust",
};

export class SourceCodeParser implements DocumentParser {
  supports(extension: string): boolean {
    return extension.toLowerCase() in EXTENSION_LANGUAGE_MAP;
  }

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const text = buffer.toString("utf8");
    const ext = extname(filename).toLowerCase();
    const language = EXTENSION_LANGUAGE_MAP[ext] || "Source Code";
    const lines = text.split(/\r?\n/);
    const sections: ParsedSection[] = [];

    // Group code by natural logical chunks (~60 lines) to retain context
    const chunkSize = 60;
    const overlap = 10;
    let start = 0;

    while (start < lines.length) {
      const end = Math.min(start + chunkSize, lines.length);
      const codeSlice = lines.slice(start, end);
      const lineStart = start + 1;
      const lineEnd = end;

      // Detect function / class signature if in the first few lines of slice
      let signature = "";
      for (const line of codeSlice.slice(0, 5)) {
        const fnMatch = line.match(/\b(?:function|class|def|interface|const|export|pub fn|fn)\s+([a-zA-Z0-9_]+)/);
        if (fnMatch) {
          signature = ` (${fnMatch[1]})`;
          break;
        }
      }

      sections.push({
        content: `\`\`\`${ext.replace(".", "")}\n// File: ${filename} (Lines ${lineStart}-${lineEnd})\n${codeSlice.join("\n")}\n\`\`\``,
        sectionHeading: `${language}${signature} (Lines ${lineStart}-${lineEnd})`,
        lineStart,
        lineEnd,
      });

      if (end === lines.length) break;
      start = end - overlap;
    }

    return {
      sections,
      metadata: {
        language,
        totalLines: lines.length,
        totalCharacters: text.length,
      },
    };
  }
}
