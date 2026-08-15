-- Push subscriptions belong to a browser origin. This is additive and keeps
-- existing subscriptions under the legacy canonical platform origin. Push
-- service endpoint hosts (for example FCM) are not application origins.
ALTER TABLE "PushSubscription" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'https://www.bazar-baz.ir';
ALTER TABLE "NotificationPermissionEvent" ADD COLUMN "origin" TEXT;
ALTER TABLE "WebPushDelivery" ADD COLUMN "subscriptionOrigin" TEXT;

-- PostgreSQL can add this constant default without rewriting every legacy row.
-- Drop the default immediately so every new subscription must supply its
-- verified request origin explicitly.
ALTER TABLE "PushSubscription" ALTER COLUMN "origin" DROP DEFAULT;

CREATE UNIQUE INDEX "PushSubscription_organizationId_customerId_origin_endpoint_key"
ON "PushSubscription"("organizationId", "customerId", "origin", "endpoint");
DROP INDEX IF EXISTS "PushSubscription_organizationId_customerId_endpoint_key";
CREATE INDEX "PushSubscription_organizationId_origin_isActive_idx"
ON "PushSubscription"("organizationId", "origin", "isActive");
