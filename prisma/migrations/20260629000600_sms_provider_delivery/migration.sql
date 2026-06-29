DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SmsDeliveryStatus') THEN
    CREATE TYPE "SmsDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SmsDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "phoneMasked" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'dry_run',
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "status" "SmsDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "externalMessageId" TEXT,
  "externalPackId" TEXT,
  "providerStatus" INTEGER,
  "providerMessage" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsDelivery_organizationId_status_createdAt_idx" ON "SmsDelivery"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "SmsDelivery_customerId_createdAt_idx" ON "SmsDelivery"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "SmsDelivery_actorUserId_idx" ON "SmsDelivery"("actorUserId");
CREATE INDEX IF NOT EXISTS "SmsDelivery_purpose_createdAt_idx" ON "SmsDelivery"("purpose", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SmsDelivery_organizationId_fkey'
  ) THEN
    ALTER TABLE "SmsDelivery"
      ADD CONSTRAINT "SmsDelivery_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SmsDelivery_customerId_fkey'
  ) THEN
    ALTER TABLE "SmsDelivery"
      ADD CONSTRAINT "SmsDelivery_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SmsDelivery_actorUserId_fkey'
  ) THEN
    ALTER TABLE "SmsDelivery"
      ADD CONSTRAINT "SmsDelivery_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
