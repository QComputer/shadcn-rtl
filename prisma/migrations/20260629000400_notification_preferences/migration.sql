DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'WEB_PUSH', 'SMS', 'EMAIL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "marketingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "transactionalEnabled" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'fa',
  "source" TEXT NOT NULL DEFAULT 'PUBLIC_SHOP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_organizationId_customerId_channel_key"
  ON "NotificationPreference"("organizationId", "customerId", "channel");

CREATE INDEX IF NOT EXISTS "NotificationPreference_organizationId_customerId_idx"
  ON "NotificationPreference"("organizationId", "customerId");

CREATE INDEX IF NOT EXISTS "NotificationPreference_customerId_channel_idx"
  ON "NotificationPreference"("customerId", "channel");

CREATE INDEX IF NOT EXISTS "NotificationPreference_organizationId_channel_marketingEnabled_idx"
  ON "NotificationPreference"("organizationId", "channel", "marketingEnabled");

DO $$ BEGIN
  ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
