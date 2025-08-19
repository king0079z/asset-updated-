-- Add isSubrecipe column to Recipe table
ALTER TABLE "Recipe"
ADD COLUMN "isSubrecipe" BOOLEAN NOT NULL DEFAULT FALSE;