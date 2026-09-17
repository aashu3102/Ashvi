-- CreateEnum
CREATE TYPE "MemorySourceType" AS ENUM ('EXPLICIT_USER', 'DERIVED', 'SYSTEM', 'IMPORTED');

-- CreateEnum
CREATE TYPE "MemoryConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MemoryScope" AS ENUM ('PRIVATE', 'SHARED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MemoryCategory" ADD VALUE 'PROJECT';
ALTER TYPE "MemoryCategory" ADD VALUE 'DECISION';
ALTER TYPE "MemoryCategory" ADD VALUE 'ROUTINE';
ALTER TYPE "MemoryCategory" ADD VALUE 'CONTEXT';

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN     "confidence" "MemoryConfidence" NOT NULL DEFAULT 'HIGH',
ADD COLUMN     "scope" "MemoryScope" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "sourceConversationId" TEXT,
ADD COLUMN     "sourceMessageId" TEXT,
ADD COLUMN     "sourceType" "MemorySourceType" NOT NULL DEFAULT 'EXPLICIT_USER',
ADD COLUMN     "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "supersededBy" TEXT,
ALTER COLUMN "source" SET DEFAULT 'EXPLICIT_MEMORY';

-- CreateIndex
CREATE INDEX "Memory_userId_status_scope_idx" ON "Memory"("userId", "status", "scope");
