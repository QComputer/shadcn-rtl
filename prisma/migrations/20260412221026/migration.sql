/*
  Warnings:

  - You are about to drop the `_DriverDeniedOrdes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_DriverDeniedOrdes" DROP CONSTRAINT "_DriverDeniedOrdes_A_fkey";

-- DropForeignKey
ALTER TABLE "_DriverDeniedOrdes" DROP CONSTRAINT "_DriverDeniedOrdes_B_fkey";

-- AlterTable
ALTER TABLE "GuestCustomer" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "guestCustomerId" TEXT;

-- DropTable
DROP TABLE "_DriverDeniedOrdes";

-- CreateTable
CREATE TABLE "Deny" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Deny_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deny_orderId_userId_key" ON "Deny"("orderId", "userId");

-- AddForeignKey
ALTER TABLE "Deny" ADD CONSTRAINT "Deny_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deny" ADD CONSTRAINT "Deny_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_guestCustomerId_fkey" FOREIGN KEY ("guestCustomerId") REFERENCES "GuestCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
