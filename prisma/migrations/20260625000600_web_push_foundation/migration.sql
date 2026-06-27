DO $$ BEGIN
  CREATE TYPE "PushPermissionState" AS ENUM ('PROMPT', 'GRANTED', 'DENIED', 'UNSUPPORTED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unsubscribedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationPermissionEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "state" "PushPermissionState" NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'PUBLIC_SHOP',
  "reason" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationPermissionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_organizationId_customerId_endpoint_key"
  ON "PushSubscription"("organizationId", "customerId", "endpoint");

CREATE INDEX IF NOT EXISTS "PushSubscription_organizationId_customerId_isActive_idx"
  ON "PushSubscription"("organizationId", "customerId", "isActive");

CREATE INDEX IF NOT EXISTS "PushSubscription_customerId_isActive_idx"
  ON "PushSubscription"("customerId", "isActive");

CREATE INDEX IF NOT EXISTS "PushSubscription_endpoint_idx"
  ON "PushSubscription"("endpoint");

CREATE INDEX IF NOT EXISTS "NotificationPermissionEvent_organizationId_customerId_createdAt_idx"
  ON "NotificationPermissionEvent"("organizationId", "customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationPermissionEvent_subscriptionId_idx"
  ON "NotificationPermissionEvent"("subscriptionId");

CREATE INDEX IF NOT EXISTS "NotificationPermissionEvent_state_createdAt_idx"
  ON "NotificationPermissionEvent"("state", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PushSubscription"
    ADD CONSTRAINT "PushSubscription_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PushSubscription"
    ADD CONSTRAINT "PushSubscription_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationPermissionEvent"
    ADD CONSTRAINT "NotificationPermissionEvent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationPermissionEvent"
    ADD CONSTRAINT "NotificationPermissionEvent_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationPermissionEvent"
    ADD CONSTRAINT "NotificationPermissionEvent_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
