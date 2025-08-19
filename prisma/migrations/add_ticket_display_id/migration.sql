-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "displayId" TEXT;

-- Create unique index for displayId
CREATE UNIQUE INDEX "Ticket_displayId_key" ON "Ticket"("displayId");

-- Update existing tickets with a display ID in format TKT-YYYYMMDD-XXXX
-- where XXXX is a sequential number starting from 0001
WITH numbered_tickets AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt") as row_num,
    TO_CHAR("createdAt", 'YYYYMMDD') as date_part
  FROM "Ticket"
)
UPDATE "Ticket" t
SET "displayId" = 'TKT-' || nt.date_part || '-' || LPAD(nt.row_num::text, 4, '0')
FROM numbered_tickets nt
WHERE t.id = nt.id;