-- CreateTable
CREATE TABLE "KitchenAssignment" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "kitchenId" TEXT NOT NULL,
    "assignedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KitchenAssignment_userId_kitchenId_key" ON "KitchenAssignment"("userId", "kitchenId");

-- AddForeignKey
ALTER TABLE "KitchenAssignment" ADD CONSTRAINT "KitchenAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenAssignment" ADD CONSTRAINT "KitchenAssignment_kitchenId_fkey" FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenAssignment" ADD CONSTRAINT "KitchenAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;