-- AlterTable
ALTER TABLE "RoleDefaultPermission" ADD COLUMN "buttonVisibility" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "buttonVisibility" JSONB;