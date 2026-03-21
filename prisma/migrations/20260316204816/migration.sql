/*
  Warnings:

  - A unique constraint covering the columns `[preparationProgressId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pickupProgressId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[deliveryProgressId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryProgressId" TEXT,
ADD COLUMN     "pickupProgressId" TEXT,
ADD COLUMN     "preparationProgressId" TEXT;

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "estimatedEndTime" TIMESTAMP(3),
    "remMinutes" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_preparationProgressId_key" ON "Order"("preparationProgressId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_pickupProgressId_key" ON "Order"("pickupProgressId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_deliveryProgressId_key" ON "Order"("deliveryProgressId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_preparationProgressId_fkey" FOREIGN KEY ("preparationProgressId") REFERENCES "Progress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupProgressId_fkey" FOREIGN KEY ("pickupProgressId") REFERENCES "Progress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryProgressId_fkey" FOREIGN KEY ("deliveryProgressId") REFERENCES "Progress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
