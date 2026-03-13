-- Add vendor performance metrics fields
ALTER TABLE "Vendor" ADD COLUMN "reliabilityScore" DOUBLE PRECISION;
ALTER TABLE "Vendor" ADD COLUMN "qualityScore" DOUBLE PRECISION;
ALTER TABLE "Vendor" ADD COLUMN "responseTimeScore" DOUBLE PRECISION;
ALTER TABLE "Vendor" ADD COLUMN "lastReviewDate" TIMESTAMP(3);
ALTER TABLE "Vendor" ADD COLUMN "notes" TEXT;