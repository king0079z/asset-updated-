-- CreateTable
CREATE TABLE "Recipe" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "servings" INTEGER NOT NULL DEFAULT 4,
  "prepTime" INTEGER NOT NULL DEFAULT 30,
  "instructions" TEXT NOT NULL,
  "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "costPerServing" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
  "id" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "foodSupplyId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeUsage" (
  "id" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "kitchenId" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "servingsUsed" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecipeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodDisposal" (
  "id" TEXT NOT NULL,
  "foodSupplyId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FoodDisposal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_foodSupplyId_fkey" FOREIGN KEY ("foodSupplyId") REFERENCES "FoodSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeUsage" ADD CONSTRAINT "RecipeUsage_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeUsage" ADD CONSTRAINT "RecipeUsage_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodDisposal" ADD CONSTRAINT "FoodDisposal_foodSupplyId_fkey" FOREIGN KEY ("foodSupplyId") REFERENCES "FoodSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodDisposal" ADD CONSTRAINT "FoodDisposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;