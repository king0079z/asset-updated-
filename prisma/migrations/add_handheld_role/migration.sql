-- Add HANDHELD to UserRole enum
ALTER TYPE "UserRole" ADD VALUE 'HANDHELD';

-- Default permissions for HANDHELD: access only to handheld app
INSERT INTO "RoleDefaultPermission" ("id", "role", "pageAccess", "canDeleteDocuments", "createdAt", "updatedAt")
VALUES (
  'handheld-default-permissions',
  'HANDHELD',
  '{"\"/handheld\"": true}'::jsonb,
  false,
  NOW(),
  NOW()
)
ON CONFLICT ("role") DO NOTHING;
