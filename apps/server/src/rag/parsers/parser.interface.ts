import type { ParseResult } from "../types.js";

export interface DocumentParser {
  supports(extension: string): boolean;
  parse(buffer: Buffer, filename: string): Promise<ParseResult>;
}
