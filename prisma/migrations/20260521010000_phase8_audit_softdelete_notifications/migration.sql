-- Phase 8: Notification timestamp/read metadata for safer dashboard polling.
ALTER TABLE "public"."Notification"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Notification_targetUserId_seen_createdAt_idx"
  ON "public"."Notification"("targetUserId", "seen", "createdAt");
