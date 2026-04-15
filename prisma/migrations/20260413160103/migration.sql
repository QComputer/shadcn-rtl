/*
  Warnings:

  - You are about to drop the column `sessionId` on the `Order` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Order_sessionId_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "sessionId";
