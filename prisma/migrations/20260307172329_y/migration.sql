/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,day,userId]` on the table `BusinessHour` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "BusinessHour_organizationId_day_key";

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHour_organizationId_day_userId_key" ON "BusinessHour"("organizationId", "day", "userId");
