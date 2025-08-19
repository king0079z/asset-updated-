-- Add source and recipeId fields to FoodDisposal table
ALTER TABLE "FoodDisposal" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'direct';
ALTER TABLE "FoodDisposal" ADD COLUMN IF NOT EXISTS "recipeId" TEXT;

-- Add foreign key constraint for recipeId
ALTER TABLE "FoodDisposal" ADD CONSTRAINT "FoodDisposal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "FoodDisposal_source_idx" ON "FoodDisposal"("source");
CREATE INDEX IF NOT EXISTS "FoodDisposal_recipeId_idx" ON "FoodDisposal"("recipeId");