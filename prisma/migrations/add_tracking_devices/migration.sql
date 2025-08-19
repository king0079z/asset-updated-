-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('GPS_TRACKER', 'OBD_DEVICE', 'ASSET_TRACKER', 'DASH_CAM', 'TEMPERATURE_MONITOR');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "TrackingDevice" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL DEFAULT 'GPS_TRACKER',
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "vehicleId" TEXT,
    "lastPing" TIMESTAMP(3),
    "batteryLevel" INTEGER,
    "firmwareVersion" TEXT,
    "installDate" TIMESTAMP(3),
    "metadata" JSONB,
    "apiKey" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLocation" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingDevice_deviceId_key" ON "TrackingDevice"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingDevice_apiKey_key" ON "TrackingDevice"("apiKey");

-- CreateIndex
CREATE INDEX "DeviceLocation_deviceId_timestamp_idx" ON "DeviceLocation"("deviceId", "timestamp");

-- AddForeignKey
ALTER TABLE "TrackingDevice" ADD CONSTRAINT "TrackingDevice_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingDevice" ADD CONSTRAINT "TrackingDevice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLocation" ADD CONSTRAINT "DeviceLocation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "TrackingDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;