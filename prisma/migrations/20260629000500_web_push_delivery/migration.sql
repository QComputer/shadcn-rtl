DO $$ BEGIN
  CREATE TYPE "WebPushDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "WebPushDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "actorUserId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'dry_run',
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "status" "WebPushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebPushDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebPushDelivery_organizationId_status_createdAt_idx"
  ON "WebPushDelivery"("organizationId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "WebPushDelivery_customerId_createdAt_idx"
  ON "WebPushDelivery"("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "WebPushDelivery_subscriptionId_idx"
  ON "WebPushDelivery"("subscriptionId");

CREATE INDEX IF NOT EXISTS "WebPushDelivery_actorUserId_idx"
  ON "WebPushDelivery"("actorUserId");

DO $$ BEGIN
  ALTER TABLE "WebPushDelivery"
    ADD CONSTRAINT "WebPushDelivery_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WebPushDelivery"
    ADD CONSTRAINT "WebPushDelivery_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WebPushDelivery"
    ADD CONSTRAINT "WebPushDelivery_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WebPushDelivery"
    ADD CONSTRAINT "WebPushDelivery_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
