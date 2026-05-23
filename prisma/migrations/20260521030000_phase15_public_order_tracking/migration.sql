-- Phase 15: add optional public tracking token for safer public order tracking links.
ALTER TABLE "public"."Order"
ADD COLUMN IF NOT EXISTS "publicTrackingToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_publicTrackingToken_key"
ON "public"."Order"("publicTrackingToken");

CREATE INDEX IF NOT EXISTS "Order_publicTrackingToken_idx"
ON "public"."Order"("publicTrackingToken");
