-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "bufferBefore" INTEGER NOT NULL DEFAULT 0,
    "bufferAfter" INTEGER NOT NULL DEFAULT 0,
    "minBookingNotice" INTEGER NOT NULL DEFAULT 60,
    "maxBookingAdvance" INTEGER NOT NULL DEFAULT 43200,
    "maxAppointmentsPerDay" INTEGER,
    "allowCancellation" BOOLEAN NOT NULL DEFAULT true,
    "cancellationDeadline" INTEGER NOT NULL DEFAULT 1440,
    "requirePhone" BOOLEAN NOT NULL DEFAULT true,
    "requireEmail" BOOLEAN NOT NULL DEFAULT false,
    "requireName" BOOLEAN NOT NULL DEFAULT true,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettings_organizationId_key" ON "BookingSettings"("organizationId");

-- CreateIndex
CREATE INDEX "BookingSettings_organizationId_idx" ON "BookingSettings"("organizationId");

-- AddForeignKey
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
