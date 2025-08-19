-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
                   ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
                   ADD COLUMN     "pageAccess" JSONB;

-- Update existing users
UPDATE "User" SET "status" = 'APPROVED';

-- Set admin@example.com as admin
UPDATE "User" SET "isAdmin" = true, "status" = 'APPROVED' WHERE "email" = 'admin@example.com';