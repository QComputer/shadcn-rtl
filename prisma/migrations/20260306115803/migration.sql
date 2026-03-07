/*
  Warnings:

  - You are about to drop the column `role` on the `OrganizationMember` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "OrganizationMember_role_idx";

-- AlterTable
ALTER TABLE "OrganizationMember" DROP COLUMN "role";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "status" TEXT,
ALTER COLUMN "locale" SET DEFAULT 'fa',
ALTER COLUMN "theme" SET DEFAULT 'system';

-- DropEnum
DROP TYPE "OrgMemberRole";

-- CreateTable
CREATE TABLE "UserBusinessHour" (
    "id" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserBusinessHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBusinessHour_userId_idx" ON "UserBusinessHour"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBusinessHour_userId_day_key" ON "UserBusinessHour"("userId", "day");

-- CreateIndex
CREATE INDEX "Appointment_guestCustomerId_idx" ON "Appointment"("guestCustomerId");

-- AddForeignKey
ALTER TABLE "UserBusinessHour" ADD CONSTRAINT "UserBusinessHour_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
