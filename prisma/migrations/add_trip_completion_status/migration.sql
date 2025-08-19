-- Add completionStatus field to VehicleTrip table
ALTER TABLE "VehicleTrip" ADD COLUMN IF NOT EXISTS "completionStatus" TEXT;

-- Update existing trips to have a default completionStatus
UPDATE "VehicleTrip" 
SET "completionStatus" = 'COMPLETED' 
WHERE "endTime" IS NOT NULL AND "completionStatus" IS NULL;