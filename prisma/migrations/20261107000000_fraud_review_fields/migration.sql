-- AlterTable
ALTER TABLE "Program" ADD COLUMN "fraudReviewFieldsVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "deductionsSeconds" JSONB;

-- AlterTable
ALTER TABLE "FraudCheck" ADD COLUMN "reviewFields" JSONB,
ADD COLUMN "deflateSeconds" INTEGER,
ADD COLUMN "deflateReason" TEXT,
ADD COLUMN "reviewerName" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);
