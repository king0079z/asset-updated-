-- Migration to implement proper multi-tenancy
-- This migration makes organizationId required for all relevant models

-- First, create a default organization for existing data
INSERT INTO "Organization" (id, name, slug, status, "createdAt", "updatedAt")
VALUES ('default-org-id', 'Default Organization', 'default-org', 'ACTIVE', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Create a default subscription for the default organization
INSERT INTO "Subscription" ("organizationId", plan, "startDate", "isActive", "maxUsers", "maxKitchens", "maxRecipes", "maxAssets", features, "createdAt", "updatedAt")
VALUES ('default-org-id', 'FREE', NOW(), true, 5, 2, 50, 100, '{}', NOW(), NOW())
ON CONFLICT ("organizationId") DO NOTHING;

-- Update existing users to have the default organization
UPDATE "User" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Update existing assets to have the default organization
UPDATE "Asset" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Update existing kitchens to have the default organization
UPDATE "Kitchen" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Update existing food supplies to have the default organization
UPDATE "FoodSupply" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Update existing recipes to have the default organization
UPDATE "Recipe" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Update existing vehicles to have the default organization
UPDATE "Vehicle" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Update existing vendors to have the default organization
UPDATE "Vendor" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Update existing tracking devices to have the default organization
UPDATE "TrackingDevice" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Add organizationId to tickets and update existing ones
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Ticket" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Add organizationId to planner tasks and update existing ones
ALTER TABLE "PlannerTask" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "PlannerTask" 
SET "organizationId" = 'default-org-id' 
WHERE "organizationId" IS NULL;

-- Add organizationId to error logs (nullable for system-wide errors)
ALTER TABLE "ErrorLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Add organizationId to audit logs (nullable for system-wide logs)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Now make the required fields NOT NULL
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Asset" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Kitchen" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FoodSupply" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Vendor" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TrackingDevice" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PlannerTask" ALTER COLUMN "organizationId" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Kitchen" ADD CONSTRAINT "Kitchen_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FoodSupply" ADD CONSTRAINT "FoodSupply_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackingDevice" ADD CONSTRAINT "TrackingDevice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlannerTask" ADD CONSTRAINT "PlannerTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "ErrorLog_organizationId_idx" ON "ErrorLog"("organizationId");
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- Create organization members for existing users
INSERT INTO "OrganizationMember" ("organizationId", "userId", role, "inviteAccepted", "createdAt", "updatedAt")
SELECT 'default-org-id', id, 'OWNER', true, NOW(), NOW()
FROM "User"
WHERE "isAdmin" = true
ON CONFLICT ("organizationId", "userId") DO NOTHING;

INSERT INTO "OrganizationMember" ("organizationId", "userId", role, "inviteAccepted", "createdAt", "updatedAt")
SELECT 'default-org-id', id, 'MEMBER', true, NOW(), NOW()
FROM "User"
WHERE "isAdmin" = false
ON CONFLICT ("organizationId", "userId") DO NOTHING;