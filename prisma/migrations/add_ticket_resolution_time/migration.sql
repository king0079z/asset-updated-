-- Add startedAt and resolutionTime fields to TicketHistory
ALTER TABLE "TicketHistory" ADD COLUMN "startedAt" TIMESTAMP;
ALTER TABLE "TicketHistory" ADD COLUMN "resolutionTime" INTEGER;