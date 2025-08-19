-- CreateTable
CREATE TABLE "VehicleTrip" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "startLatitude" DOUBLE PRECISION NOT NULL,
  "startLongitude" DOUBLE PRECISION NOT NULL,
  "endLatitude" DOUBLE PRECISION,
  "endLongitude" DOUBLE PRECISION,
  "distance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isAutoStarted" BOOLEAN NOT NULL DEFAULT false,
  "isAutoEnded" BOOLEAN NOT NULL DEFAULT false,
  "completionStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleTrip_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;