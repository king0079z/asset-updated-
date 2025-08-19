-- Make endDate optional in VehicleRental table
ALTER TABLE "VehicleRental" ALTER COLUMN "endDate" DROP NOT NULL;

-- Add new fields to VehicleRental table
ALTER TABLE "VehicleRental" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "VehicleRental" ADD COLUMN IF NOT EXISTS "dailyRate" DECIMAL(10,2);
ALTER TABLE "VehicleRental" ADD COLUMN IF NOT EXISTS "totalCost" DECIMAL(10,2);