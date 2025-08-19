-- Create Organization model
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE');

-- Create Organization table
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logo" TEXT,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Create unique index on slug
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- Create Subscription table
CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "maxUsers" INTEGER NOT NULL DEFAULT 5,
  "maxKitchens" INTEGER NOT NULL DEFAULT 2,
  "maxRecipes" INTEGER NOT NULL DEFAULT 50,
  "maxAssets" INTEGER NOT NULL DEFAULT 100,
  "features" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Create foreign key from Subscription to Organization
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique index on organizationId (one subscription per organization)
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- Create OrganizationMember table to track members of an organization
CREATE TABLE "OrganizationMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "invitedEmail" TEXT,
  "inviteAccepted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- Create foreign keys for OrganizationMember
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique index to ensure a user can only be a member of an organization once
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- Create BillingHistory table to track billing events
CREATE TABLE "BillingHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL,
  "description" TEXT,
  "stripeInvoiceId" TEXT,
  "stripePaymentIntentId" TEXT,
  "billingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "BillingHistory_pkey" PRIMARY KEY ("id")
);

-- Create foreign key from BillingHistory to Organization
ALTER TABLE "BillingHistory" ADD CONSTRAINT "BillingHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add organizationId to existing models to support multi-tenancy
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Asset" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Kitchen" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Kitchen" ADD CONSTRAINT "Kitchen_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FoodSupply" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "FoodSupply" ADD CONSTRAINT "FoodSupply_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Recipe" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Vehicle" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Vendor" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create UsageMetrics table to track organization usage
CREATE TABLE "UsageMetrics" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "activeUsers" INTEGER NOT NULL DEFAULT 0,
  "totalKitchens" INTEGER NOT NULL DEFAULT 0,
  "totalRecipes" INTEGER NOT NULL DEFAULT 0,
  "totalAssets" INTEGER NOT NULL DEFAULT 0,
  "apiCalls" INTEGER NOT NULL DEFAULT 0,
  "storageUsed" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "UsageMetrics_pkey" PRIMARY KEY ("id")
);

-- Create foreign key from UsageMetrics to Organization
ALTER TABLE "UsageMetrics" ADD CONSTRAINT "UsageMetrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique index on organizationId and date
CREATE UNIQUE INDEX "UsageMetrics_organizationId_date_key" ON "UsageMetrics"("organizationId", "date");