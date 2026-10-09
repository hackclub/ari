-- AlterTable
ALTER TABLE "McpToken" ADD COLUMN "programIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "McpAuthCode" ADD COLUMN "programIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
