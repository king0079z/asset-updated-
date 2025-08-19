-- Add customRoleId field to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customRoleId" TEXT;