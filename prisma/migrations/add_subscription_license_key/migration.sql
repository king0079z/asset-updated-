-- Add license key fields to Subscription model
ALTER TABLE "Subscription" ADD COLUMN "licenseKey" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "licenseKeyCreatedAt" TIMESTAMP(3);