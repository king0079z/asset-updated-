-- Add sellingPrice field to Recipe table
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;