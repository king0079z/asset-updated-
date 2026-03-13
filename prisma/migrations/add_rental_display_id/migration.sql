-- AlterTable
ALTER TABLE "VehicleRental" ADD COLUMN "displayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRental_displayId_key" ON "VehicleRental"("displayId");

-- Update existing rentals with a display ID
UPDATE "VehicleRental"
SET "displayId" = 'RNT-' || EXTRACT(YEAR FROM "startDate")::TEXT || '-' || LPAD(ROW_NUMBER() OVER (ORDER BY "startDate")::TEXT, 4, '0')
WHERE "displayId" IS NULL;