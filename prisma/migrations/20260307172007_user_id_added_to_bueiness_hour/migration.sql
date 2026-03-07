/*
  Warnings:

  - You are about to drop the `UserBusinessHour` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserBusinessHour" DROP CONSTRAINT "UserBusinessHour_userId_fkey";

-- AlterTable
ALTER TABLE "BusinessHour" ADD COLUMN     "userId" TEXT;

-- DropTable
DROP TABLE "UserBusinessHour";

-- AddForeignKey
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
