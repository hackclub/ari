-- CreateTable
CREATE TABLE "McpOauthClient" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpOauthClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpOauthClient_createdAt_idx" ON "McpOauthClient"("createdAt");

-- pending codes expire within minutes and cannot name a registered client, so they are dropped
DELETE FROM "McpAuthCode";

-- AlterTable
ALTER TABLE "McpAuthCode" ADD COLUMN     "clientId" TEXT NOT NULL,
ADD COLUMN     "parentTokenId" TEXT;

-- AlterTable
ALTER TABLE "McpToken" ADD COLUMN     "parentTokenId" TEXT;

-- CreateIndex
CREATE INDEX "McpAuthCode_clientId_idx" ON "McpAuthCode"("clientId");

-- CreateIndex
CREATE INDEX "McpAuthCode_parentTokenId_idx" ON "McpAuthCode"("parentTokenId");

-- CreateIndex
CREATE INDEX "McpToken_parentTokenId_idx" ON "McpToken"("parentTokenId");

-- AddForeignKey
ALTER TABLE "McpAuthCode" ADD CONSTRAINT "McpAuthCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "McpOauthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpAuthCode" ADD CONSTRAINT "McpAuthCode_parentTokenId_fkey" FOREIGN KEY ("parentTokenId") REFERENCES "McpToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpToken" ADD CONSTRAINT "McpToken_parentTokenId_fkey" FOREIGN KEY ("parentTokenId") REFERENCES "McpToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
