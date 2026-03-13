-- Create RoleDefaultPermission table
CREATE TABLE "RoleDefaultPermission" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "pageAccess" JSONB NOT NULL,
    "canDeleteDocuments" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleDefaultPermission_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on role to ensure only one default per role
CREATE UNIQUE INDEX "RoleDefaultPermission_role_key" ON "RoleDefaultPermission"("role");