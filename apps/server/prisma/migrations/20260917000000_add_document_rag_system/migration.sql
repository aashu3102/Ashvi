-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('PRIVATE', 'SHARED');

-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'UPLOADED';
ALTER TYPE "DocumentStatus" ADD VALUE 'INDEXED';
ALTER TYPE "DocumentStatus" ADD VALUE 'PARTIAL';
ALTER TYPE "DocumentStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "scope" "DocumentScope" NOT NULL DEFAULT 'PRIVATE';

-- DropIndex
DROP INDEX IF EXISTS "Document_userId_status_idx";

-- CreateIndex
CREATE INDEX "Document_userId_status_scope_idx" ON "Document"("userId", "status", "scope");
CREATE INDEX "Document_scope_status_idx" ON "Document"("scope", "status");

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN "pageNumber" INTEGER;
ALTER TABLE "DocumentChunk" ADD COLUMN "sectionHeading" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN "slideNumber" INTEGER;
ALTER TABLE "DocumentChunk" ADD COLUMN "sheetName" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN "lineStart" INTEGER;
ALTER TABLE "DocumentChunk" ADD COLUMN "lineEnd" INTEGER;
ALTER TABLE "DocumentChunk" ADD COLUMN "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[];
ALTER TABLE "DocumentChunk" ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentChunk_documentId_chunkIndex_idx" ON "DocumentChunk"("documentId", "chunkIndex");
