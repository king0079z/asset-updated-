-- Add KPI fields to PlannerTask
ALTER TABLE "PlannerTask" ADD COLUMN "assignedToUserId" UUID;
ALTER TABLE "PlannerTask" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "PlannerTask" ADD COLUMN "estimatedHours" DOUBLE PRECISION;
ALTER TABLE "PlannerTask" ADD COLUMN "actualHours" DOUBLE PRECISION;

-- Add foreign key constraint for assignedToUserId
ALTER TABLE "PlannerTask" ADD CONSTRAINT "PlannerTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;