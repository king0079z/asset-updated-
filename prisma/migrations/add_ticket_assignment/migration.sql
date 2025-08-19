-- Add assignedToId field to Ticket table
ALTER TABLE "Ticket" ADD COLUMN "assignedToId" UUID;

-- Add foreign key constraint
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;