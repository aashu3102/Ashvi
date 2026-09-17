import { extname } from "node:path";
import type { DocumentParser } from "./parser.interface.js";
import { PdfParser } from "./pdf.parser.js";
import { DocxParser } from "./docx.parser.js";
import { PptxParser } from "./pptx.parser.js";
import { SpreadsheetParser } from "./spreadsheet.parser.js";
import { TextParser } from "./text.parser.js";
import { SourceCodeParser } from "./code.parser.js";
import type { ParseResult } from "../types.js";

export class ParserRegistry {
  private parsers: DocumentParser[];

  constructor() {
    this.parsers = [
      new PdfParser(),
      new DocxParser(),
      new PptxParser(),
      new SpreadsheetParser(),
      new TextParser(),
      new SourceCodeParser(),
    ];
  }

  register(parser: DocumentParser): void {
    this.parsers.unshift(parser);
  }

  getParser(filename: string): DocumentParser | undefined {
    const ext = extname(filename).toLowerCase();
    return this.parsers.find((p) => p.supports(ext));
  }

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const parser = this.getParser(filename);
    if (!parser) {
      throw new Error(`No parser registered for file extension "${extname(filename)}"`);
    }
    return parser.parse(buffer, filename);
  }
}
