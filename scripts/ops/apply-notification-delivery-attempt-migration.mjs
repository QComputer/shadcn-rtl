import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is not set")
  process.exit(1)
}

const sql = neon(databaseUrl)

async function runMigration() {
  try {
    console.log("Applying NotificationDeliveryAttempt migration...")
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationDeliveryAttemptStatus') THEN
          CREATE TYPE "NotificationDeliveryAttemptStatus" AS ENUM (
            'QUEUED',
            'SENT',
            'DRY_RUN',
            'SKIPPED',
            'FAILED',
            'RETRY_SCHEDULED',
            'RETRY_EXHAUSTED'
          );
        END IF;
      END
      $$;
    `
    console.log("OK: NotificationDeliveryAttemptStatus type ensured")

    await sql`
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
    `
    console.log("OK: NotificationDeliveryAttempt table ensured")

    await sql`
      CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_organizationId_status_createdAt_idx"
        ON "NotificationDeliveryAttempt"("organizationId", "status", "createdAt");
    `
    await sql`
      CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_targetUserId_idx"
        ON "NotificationDeliveryAttempt"("targetUserId");
    `
    await sql`
      CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_orderId_idx"
        ON "NotificationDeliveryAttempt"("orderId");
    `
    await sql`
      CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_guestCustomerId_idx"
        ON "NotificationDeliveryAttempt"("guestCustomerId");
    `
    await sql`
      CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_notificationId_idx"
        ON "NotificationDeliveryAttempt"("notificationId");
    `
    console.log("OK: NotificationDeliveryAttempt indexes ensured")

    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'NotificationDeliveryAttempt'
    `
    if (tables.length > 0) {
      console.log("VERIFIED: NotificationDeliveryAttempt table exists")
    } else {
      console.error("FAIL: NotificationDeliveryAttempt table not found after migration")
      process.exit(1)
    }
  } catch (err) {
    console.error("Migration failed:", err)
    process.exit(1)
  }
}

runMigration()
