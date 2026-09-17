import * as XLSX from "xlsx";
import type { DocumentParser } from "./parser.interface.js";
import type { ParseResult, ParsedSection } from "../types.js";

export class SpreadsheetParser implements DocumentParser {
  supports(extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === ".xlsx" || ext === ".xls" || ext === ".csv";
  }

  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    } catch (err) {
      throw new Error(`Failed to parse spreadsheet "${filename}": ${err instanceof Error ? err.message : String(err)}`);
    }

    const sections: ParsedSection[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // Convert sheet to CSV rows for human and model readability
      const csvData = XLSX.utils.sheet_to_csv(worksheet, { FS: " | ", RS: "\n" }).trim();
      if (!csvData) continue;

      const lines = csvData.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length === 0) continue;

      // If sheet has many rows, chunk rows in groups of ~50 to keep tabular structure intact
      const chunkSize = 50;
      const header = lines[0];

      for (let i = 0; i < lines.length; i += chunkSize) {
        const rowSlice = lines.slice(i, i + chunkSize);
        // Include header on subsequent chunks if rows start after row 0
        const contentLines = i > 0 && !rowSlice.includes(header) ? [header, ...rowSlice] : rowSlice;
        const startRow = i + 1;
        const endRow = Math.min(i + chunkSize, lines.length);

        sections.push({
          content: `Sheet: ${sheetName} (Rows ${startRow}-${endRow})\n${contentLines.join("\n")}`,
          sheetName,
          sectionHeading: `${sheetName} (Rows ${startRow}-${endRow})`,
          lineStart: startRow,
          lineEnd: endRow,
        });
      }
    }

    return {
      sections,
      metadata: {
        sheetNames: workbook.SheetNames,
        sheetCount: workbook.SheetNames.length,
      },
      pageCount: workbook.SheetNames.length,
    };
  }
}
