-- Add kitchenId field to FoodDisposal table
ALTER TABLE "FoodDisposal" ADD COLUMN "kitchenId" TEXT;

-- Add foreign key constraint
ALTER TABLE "FoodDisposal" ADD CONSTRAINT "FoodDisposal_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for better query performance
CREATE INDEX "FoodDisposal_kitchenId_idx" ON "FoodDisposal"("kitchenId");