-- 1. Allow RecipeIngredient to reference either a FoodSupply or a subrecipe (Recipe)
ALTER TABLE "RecipeIngredient" ADD COLUMN "subRecipeId" TEXT;

ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_subRecipeId_fkey"
  FOREIGN KEY ("subRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL;

-- 2. Make foodSupplyId nullable (since an ingredient can now be a food supply OR a subrecipe)
ALTER TABLE "RecipeIngredient" ALTER COLUMN "foodSupplyId" DROP NOT NULL;

-- 3. Add a new table for ingredient-level waste tracking
CREATE TABLE "IngredientWaste" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipeIngredientId" TEXT NOT NULL,
  "wasteType" TEXT NOT NULL,
  "wastePercentage" FLOAT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "IngredientWaste_recipeIngredientId_fkey" FOREIGN KEY ("recipeIngredientId") REFERENCES "RecipeIngredient"("id") ON DELETE CASCADE
);

-- 4. (Optional) Add a computed column for total waste percentage per ingredient (handled in code, not DB)