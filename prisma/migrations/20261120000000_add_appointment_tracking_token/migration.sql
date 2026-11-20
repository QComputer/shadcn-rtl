-- Add tracking token fields to Appointment model
ALTER TABLE "Appointment" ADD COLUMN "trackingTokenHash" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "trackingTokenExpiresAt" TIMESTAMP(3);

-- Create index on trackingTokenHash
CREATE INDEX "Appointment_trackingTokenHash_idx" ON "Appointment"("trackingTokenHash");