-- Add barcode and kitchenId fields to FoodSupply table
ALTER TABLE "FoodSupply" ADD COLUMN "barcode" TEXT;
ALTER TABLE "FoodSupply" ADD COLUMN "kitchenId" TEXT;

-- Add unique constraint to barcode
ALTER TABLE "FoodSupply" ADD CONSTRAINT "FoodSupply_barcode_key" UNIQUE ("barcode");

-- Add foreign key constraint for kitchenId
ALTER TABLE "FoodSupply" ADD CONSTRAINT "FoodSupply_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update existing KitchenBarcode entries to populate the direct barcode field in FoodSupply
UPDATE "FoodSupply" fs
SET "barcode" = kb.barcode, "kitchenId" = kb.kitchenId
FROM "KitchenBarcode" kb
WHERE fs.id = kb.foodSupplyId;