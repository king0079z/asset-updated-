-- CreateTable
CREATE TABLE "ReportHistory" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "userEmail" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "itemScope" TEXT NOT NULL,
    "specificItemId" TEXT,
    "dateRange" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportHistory_pkey" PRIMARY KEY ("id")
);