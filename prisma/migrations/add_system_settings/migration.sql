-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "lastUpdatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- Insert default document management settings
INSERT INTO "SystemSettings" ("id", "key", "value", "description", "createdAt", "updatedAt")
VALUES (
    'cls_doc_settings',
    'documentManagementSettings',
    '{"showDeleteButton": true}',
    'Settings for document management features visibility',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);