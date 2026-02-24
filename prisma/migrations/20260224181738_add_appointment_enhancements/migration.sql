/*
  Warnings:

  - A unique constraint covering the columns `[bookingReference]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bookingReference" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedBy" TEXT,
ADD COLUMN     "customerEmailAtBooking" TEXT,
ADD COLUMN     "customerNameAtBooking" TEXT,
ADD COLUMN     "customerPhoneAtBooking" TEXT,
ADD COLUMN     "followUpSentAt" TIMESTAMP(3),
ADD COLUMN     "followUpSentBy" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentBy" TEXT;

-- CreateTable
CREATE TABLE "StaffAvailability" (
    "id" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "specificDate" TIMESTAMP(3),
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT,
    "selectedDate" TIMESTAMP(3),
    "selectedTime" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'started',
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAvailability_organizationId_idx" ON "StaffAvailability"("organizationId");

-- CreateIndex
CREATE INDEX "StaffAvailability_staffId_idx" ON "StaffAvailability"("staffId");

-- CreateIndex
CREATE INDEX "StaffAvailability_specificDate_idx" ON "StaffAvailability"("specificDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAvailability_staffId_dayOfWeek_specificDate_key" ON "StaffAvailability"("staffId", "dayOfWeek", "specificDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSession_sessionId_key" ON "BookingSession"("sessionId");

-- CreateIndex
CREATE INDEX "BookingSession_organizationId_idx" ON "BookingSession"("organizationId");

-- CreateIndex
CREATE INDEX "BookingSession_sessionId_idx" ON "BookingSession"("sessionId");

-- CreateIndex
CREATE INDEX "BookingSession_status_idx" ON "BookingSession"("status");

-- CreateIndex
CREATE INDEX "BookingSession_expiresAt_idx" ON "BookingSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_bookingReference_key" ON "Appointment"("bookingReference");

-- CreateIndex
CREATE INDEX "Appointment_bookingReference_idx" ON "Appointment"("bookingReference");

-- AddForeignKey
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "OrganizationMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
