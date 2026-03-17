-- CreateTable
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "RoleDefaultPermission" 
ADD COLUMN "customRoleId" TEXT,
ADD COLUMN "customRoleName" TEXT,
ALTER COLUMN "role" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_name_key" ON "CustomRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDefaultPermission_customRoleId_key" ON "RoleDefaultPermission"("customRoleId");