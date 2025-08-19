-- Add totalWasted field to FoodSupply table
ALTER TABLE "FoodSupply" ADD COLUMN "totalWasted" FLOAT NOT NULL DEFAULT 0;

-- Update existing records to set totalWasted to 0
UPDATE "FoodSupply" SET "totalWasted" = 0 WHERE "totalWasted" IS NULL;