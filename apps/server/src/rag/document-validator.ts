import { basename, extname } from "node:path";

export interface ValidationConfig {
  maxFileSizeMb?: number;
  maxFilesPerBatch?: number;
  maxPages?: number;
}

export const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".json",
  ".sql",
  ".html",
  ".css",
  ".c",
  ".cpp",
  ".h",
  ".java",
  ".go",
  ".rs",
]);

export class DocumentValidationError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "DocumentValidationError";
    this.code = code;
  }
}

export class DocumentValidator {
  private maxFileSizeMb: number;
  private maxFilesPerBatch: number;
  private maxPages: number;

  constructor(config: ValidationConfig = {}) {
    this.maxFileSizeMb = config.maxFileSizeMb ?? 50;
    this.maxFilesPerBatch = config.maxFilesPerBatch ?? 30;
    this.maxPages = config.maxPages ?? 800;
  }

  sanitizeFilename(rawFilename: string): string {
    if (!rawFilename || !rawFilename.trim()) {
      throw new DocumentValidationError("Filename cannot be empty.", "EMPTY_FILENAME");
    }

    // Strip directory traversal and unsafe characters
    const clean = basename(rawFilename)
      .replace(/[\0\r\n]/g, "")
      .replace(/[/\\]/g, "_")
      .trim();

    if (clean === "." || clean === ".." || clean.length === 0) {
      throw new DocumentValidationError("Invalid or dangerous filename.", "PATH_TRAVERSAL_DETECTED");
    }

    if (clean.length > 255) {
      return clean.slice(0, 255);
    }

    return clean;
  }

  validateBatchSize(fileCount: number): void {
    if (fileCount === 0) {
      throw new DocumentValidationError("At least one document is required.", "NO_FILES_PROVIDED");
    }
    if (fileCount > this.maxFilesPerBatch) {
      throw new DocumentValidationError(
        `Batch upload limit exceeded: maximum ${this.maxFilesPerBatch} files allowed per upload.`,
        "BATCH_LIMIT_EXCEEDED"
      );
    }
  }

  validateExtension(filename: string): string {
    const ext = extname(filename).toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.has(ext)) {
      throw new DocumentValidationError(
        `Unsupported document format: "${ext}". Supported formats are PDF, DOCX, PPTX, XLSX, CSV, TXT, Markdown, and source code.`,
        "UNSUPPORTED_FILE_TYPE"
      );
    }
    return ext;
  }

  validateFileSize(sizeInBytes: number, filename: string): void {
    if (sizeInBytes <= 0) {
      throw new DocumentValidationError(
        `Document "${filename}" is empty (0 bytes).`,
        "EMPTY_FILE"
      );
    }

    const maxBytes = this.maxFileSizeMb * 1024 * 1024;
    if (sizeInBytes > maxBytes) {
      throw new DocumentValidationError(
        `Document "${filename}" exceeds the maximum allowed size of ${this.maxFileSizeMb}MB.`,
        "FILE_TOO_LARGE"
      );
    }
  }

  validateMagicBytes(buffer: Buffer, extension: string, filename: string): void {
    const ext = extension.toLowerCase();

    if (ext === ".pdf") {
      const header = buffer.subarray(0, 4).toString("ascii");
      if (header !== "%PDF") {
        throw new DocumentValidationError(
          `Document "${filename}" is not a valid PDF file.`,
          "CORRUPT_OR_INVALID_FILE"
        );
      }
    } else if (ext === ".docx" || ext === ".pptx" || ext === ".xlsx") {
      // Zip header: 0x50 0x4B 0x03 0x04 or 0x50 0x4B
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        throw new DocumentValidationError(
          `Document "${filename}" is not a valid Office open XML document.`,
          "CORRUPT_OR_INVALID_FILE"
        );
      }
    } else {
      // Text / CSV / Code formats: Check first 512 bytes for null byte binary corruption
      const sample = buffer.subarray(0, Math.min(buffer.length, 512));
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) {
          throw new DocumentValidationError(
            `Document "${filename}" appears to be an incompatible binary file.`,
            "BINARY_FILE_REJECTED"
          );
        }
      }
    }
  }

  validatePageCount(pageCount: number, filename: string): void {
    if (pageCount > this.maxPages) {
      throw new DocumentValidationError(
        `Document "${filename}" has ${pageCount} pages, exceeding the maximum allowed limit of ${this.maxPages} pages.`,
        "PAGE_LIMIT_EXCEEDED"
      );
    }
  }
}
