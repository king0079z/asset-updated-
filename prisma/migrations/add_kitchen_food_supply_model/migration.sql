-- Add expirationDate to FoodConsumption table
ALTER TABLE "FoodConsumption" ADD COLUMN "expirationDate" TIMESTAMP(3);

-- Create KitchenFoodSupply table if it doesn't exist already
-- (This is a safety check since we already defined it in the schema)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'KitchenFoodSupply') THEN
        CREATE TABLE "KitchenFoodSupply" (
            "id" TEXT NOT NULL,
            "kitchenId" TEXT NOT NULL,
            "foodSupplyId" TEXT NOT NULL,
            "quantity" DOUBLE PRECISION NOT NULL,
            "expirationDate" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "KitchenFoodSupply_pkey" PRIMARY KEY ("id")
        );

        -- Create unique constraint
        CREATE UNIQUE INDEX "KitchenFoodSupply_kitchenId_foodSupplyId_key" ON "KitchenFoodSupply"("kitchenId", "foodSupplyId");

        -- Add foreign key constraints
        ALTER TABLE "KitchenFoodSupply" ADD CONSTRAINT "KitchenFoodSupply_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        ALTER TABLE "KitchenFoodSupply" ADD CONSTRAINT "KitchenFoodSupply_foodSupplyId_fkey" FOREIGN KEY ("foodSupplyId") REFERENCES "FoodSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;