-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "barcode" TEXT;

-- Create unique index for barcode
CREATE UNIQUE INDEX "Ticket_barcode_key" ON "Ticket"("barcode");