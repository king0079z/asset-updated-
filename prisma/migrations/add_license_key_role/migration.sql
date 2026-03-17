-- CreateTable
CREATE TABLE "LicenseKeyRole" (
  "id" TEXT NOT NULL,
  "licenseKey" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "plan" TEXT,
  "expirationDate" TIMESTAMP(3),
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LicenseKeyRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseKeyRole_licenseKey_key" ON "LicenseKeyRole"("licenseKey");

-- AddForeignKey
ALTER TABLE "LicenseKeyRole" ADD CONSTRAINT "LicenseKeyRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;