-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'STAFF';

-- Update existing admin users to have ADMIN role
UPDATE "User" SET "role" = 'ADMIN' WHERE "isAdmin" = true;