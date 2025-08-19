-- CreateEnum
CREATE TYPE "AuditLogType" AS ENUM ('USER_ACTIVITY', 'DATA_ACCESS', 'DATA_MODIFICATION', 'SECURITY_EVENT', 'SYSTEM_EVENT', 'COMPLIANCE_EVENT');

-- CreateEnum
CREATE TYPE "AuditLogSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,
    "userEmail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "changes" JSONB,
    "status" TEXT,
    "type" "AuditLogType" NOT NULL DEFAULT 'USER_ACTIVITY',
    "severity" "AuditLogSeverity" NOT NULL DEFAULT 'INFO',
    "relatedLogId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" UUID,
    "retentionDate" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");

-- CreateIndex
CREATE INDEX "AuditLog_resourceId_idx" ON "AuditLog"("resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_type_idx" ON "AuditLog"("type");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- Add retention policy function
CREATE OR REPLACE FUNCTION delete_expired_audit_logs() RETURNS void AS $$
BEGIN
  DELETE FROM "AuditLog" WHERE "retentionDate" IS NOT NULL AND "retentionDate" < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;