-- CreateTable
CREATE TABLE "VehicleLocation" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VehicleLocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VehicleLocation" ADD CONSTRAINT "VehicleLocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index for faster queries
CREATE INDEX "VehicleLocation_vehicleId_timestamp_idx" ON "VehicleLocation"("vehicleId", "timestamp");