-- Remove OCR fields from AssetDocument table
ALTER TABLE "AssetDocument" DROP COLUMN IF EXISTS "ocrProcessed";
ALTER TABLE "AssetDocument" DROP COLUMN IF EXISTS "ocrData";
ALTER TABLE "AssetDocument" DROP COLUMN IF EXISTS "ocrSummary";