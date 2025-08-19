-- Add canDeleteDocuments field to User table
ALTER TABLE "User" ADD COLUMN "canDeleteDocuments" BOOLEAN NOT NULL DEFAULT false;

-- Set default permissions: ADMIN and MANAGER roles can delete documents by default
UPDATE "User" SET "canDeleteDocuments" = true WHERE "role" IN ('ADMIN', 'MANAGER');