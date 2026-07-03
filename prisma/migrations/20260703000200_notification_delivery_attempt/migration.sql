-- Phase P120C: add unified notification delivery attempt observability table.

CREATE TYPE IF NOT EXISTS "NotificationDeliveryAttemptStatus" AS ENUM (
  'QUEUED',
  'SENT',
  'DRY_RUN',
  'SKIPPED',
  'FAILED',
  'RETRY_SCHEDULED',
  'RETRY_EXHAUSTED'
);

CREATE TABLE IF NOT EXISTS "NotificationDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "orderId" TEXT,
  "guestCustomerId" TEXT,
  "notificationId" TEXT,
  "channel" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" "NotificationDeliveryAttemptStatus" NOT NULL DEFAULT 'QUEUED',
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "retryable" BOOLEAN NOT NULL DEFAULT false,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP,
  "lastErrorCode" TEXT,
  "lastErrorText" TEXT,
  "providerMessageId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_organizationId_status_createdAt_idx"
  ON "NotificationDeliveryAttempt"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_targetUserId_idx"
  ON "NotificationDeliveryAttempt"("targetUserId");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_orderId_idx"
  ON "NotificationDeliveryAttempt"("orderId");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_guestCustomerId_idx"
  ON "NotificationDeliveryAttempt"("guestCustomerId");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_notificationId_idx"
  ON "NotificationDeliveryAttempt"("notificationId");
