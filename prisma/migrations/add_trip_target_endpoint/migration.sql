-- Add target endpoint fields to VehicleTrip table
ALTER TABLE "VehicleTrip" ADD COLUMN "targetEndLatitude" DOUBLE PRECISION;
ALTER TABLE "VehicleTrip" ADD COLUMN "targetEndLongitude" DOUBLE PRECISION;