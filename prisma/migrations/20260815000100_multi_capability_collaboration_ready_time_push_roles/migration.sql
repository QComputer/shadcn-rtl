-- Additive tenant capability and collaboration foundation.
CREATE TYPE "OrganizationCapabilityKey" AS ENUM ('SHOP', 'APPOINTMENT');
CREATE TYPE "OrganizationCapabilityStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "OrganizationCollaborationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "OrganizationCollaborationDirection" AS ENUM ('ONE_WAY', 'TWO_WAY');
CREATE TYPE "OrganizationCollaborationScopeKey" AS ENUM ('CUSTOMER_IDENTITY', 'CUSTOMER_PROFILE', 'ORDER_VISIBILITY', 'LOYALTY', 'COURIER', 'EMPLOYEE_SCHEDULE', 'CONTACT_INFORMATION');

ALTER TABLE "Organization" ADD COLUMN "capabilitiesInitializedAt" TIMESTAMP(3);

CREATE TABLE "OrganizationCapability" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" "OrganizationCapabilityKey" NOT NULL,
  "status" "OrganizationCapabilityStatus" NOT NULL DEFAULT 'ACTIVE',
  "settings" JSONB,
  "enabledAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationCapability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationCapability_status_timestamps" CHECK (
    ("status" = 'ACTIVE' AND "enabledAt" IS NOT NULL AND "disabledAt" IS NULL)
    OR ("status" = 'INACTIVE' AND "disabledAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "OrganizationCapability_organizationId_key_key" ON "OrganizationCapability"("organizationId", "key");

CREATE TABLE "OrganizationCollaboration" (
  "id" TEXT NOT NULL,
  "ownerOrgId" TEXT NOT NULL,
  "partnerOrgId" TEXT NOT NULL,
  "status" "OrganizationCollaborationStatus" NOT NULL DEFAULT 'PENDING',
  "direction" "OrganizationCollaborationDirection" NOT NULL DEFAULT 'TWO_WAY',
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "revokedById" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "retentionPolicy" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationCollaboration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationCollaboration_distinct_orgs" CHECK ("ownerOrgId" <> "partnerOrgId"),
  CONSTRAINT "OrganizationCollaboration_valid_window" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE TABLE "OrganizationCollaborationScope" (
  "id" TEXT NOT NULL,
  "collaborationId" TEXT NOT NULL,
  "scope" "OrganizationCollaborationScopeKey" NOT NULL,
  "ownerToPartner" BOOLEAN NOT NULL DEFAULT false,
  "partnerToOwner" BOOLEAN NOT NULL DEFAULT false,
  "writeAccess" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationCollaborationScope_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationCollaborationScope_write_has_direction" CHECK (NOT "writeAccess" OR "ownerToPartner" OR "partnerToOwner")
);

-- BEGIN LEGACY CAPABILITY BACKFILL
-- Existing tenants retain their behavior. Some pre-canonical installations used
-- SERVICE for appointment businesses, so map both labels explicitly instead of
-- casting the legacy enum directly. The conflict guard and NULL-only marker make
-- this block safe to re-run during recovery without duplicating capabilities or
-- changing an already-initialized tenant.
INSERT INTO "OrganizationCapability" ("id", "organizationId", "key", "status", "enabledAt", "createdAt", "updatedAt")
SELECT
  concat('cap_', md5("id" || ':' || CASE WHEN "type"::text IN ('APPOINTMENT', 'SERVICE') THEN 'APPOINTMENT' ELSE 'SHOP' END)),
  "id",
  (CASE WHEN "type"::text IN ('APPOINTMENT', 'SERVICE') THEN 'APPOINTMENT' ELSE 'SHOP' END)::"OrganizationCapabilityKey",
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization"
WHERE "type"::text IN ('SHOP', 'APPOINTMENT', 'SERVICE')
ON CONFLICT ("organizationId", "key") DO NOTHING;
UPDATE "Organization"
SET "capabilitiesInitializedAt" = CURRENT_TIMESTAMP
WHERE "capabilitiesInitializedAt" IS NULL
AND EXISTS (
  SELECT 1 FROM "OrganizationCapability" c
  WHERE c."organizationId" = "Organization"."id"
);
-- END LEGACY CAPABILITY BACKFILL

ALTER TABLE "Product" ADD COLUMN "preparationMinutes" INTEGER;
ALTER TABLE "OrganizationSettings" ADD COLUMN "defaultPreparationMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Order" ADD COLUMN "estimatedReadyAt" TIMESTAMP(3),
ADD COLUMN "preparationMinutesSnapshot" INTEGER,
ADD COLUMN "readyTimeVersion" INTEGER NOT NULL DEFAULT 0;

-- Validate duration/version invariants at the storage boundary as well as in
-- API/service validation. NOT VALID avoids a long exclusive validation lock on
-- existing tables; the following validation runs with a lighter lock.
ALTER TABLE "Product" ADD CONSTRAINT "Product_preparationMinutes_range" CHECK ("preparationMinutes" IS NULL OR "preparationMinutes" BETWEEN 1 AND 1440) NOT VALID;
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_defaultPreparationMinutes_range" CHECK ("defaultPreparationMinutes" BETWEEN 1 AND 1440) NOT VALID;
ALTER TABLE "Order" ADD CONSTRAINT "Order_preparationMinutesSnapshot_range" CHECK ("preparationMinutesSnapshot" IS NULL OR "preparationMinutesSnapshot" BETWEEN 1 AND 1440) NOT VALID;
ALTER TABLE "Order" ADD CONSTRAINT "Order_readyTimeVersion_nonnegative" CHECK ("readyTimeVersion" >= 0) NOT VALID;
ALTER TABLE "Product" VALIDATE CONSTRAINT "Product_preparationMinutes_range";
ALTER TABLE "OrganizationSettings" VALIDATE CONSTRAINT "OrganizationSettings_defaultPreparationMinutes_range";
ALTER TABLE "Order" VALIDATE CONSTRAINT "Order_preparationMinutesSnapshot_range";
ALTER TABLE "Order" VALIDATE CONSTRAINT "Order_readyTimeVersion_nonnegative";

CREATE TABLE "OrderReadyTimeHistory" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "previousEstimatedReadyAt" TIMESTAMP(3),
  "estimatedReadyAt" TIMESTAMP(3) NOT NULL,
  "preparationMinutes" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderReadyTimeHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderReadyTimeHistory_positive_minutes" CHECK ("preparationMinutes" BETWEEN 1 AND 1440)
);

ALTER TABLE "PushSubscription" ADD COLUMN "recipientRole" "UserRole";
ALTER TABLE "NotificationPreference" ADD COLUMN "recipientRole" "UserRole";
ALTER TABLE "WebPushDelivery" ADD COLUMN "recipientRole" "UserRole",
ADD COLUMN "targetUrl" TEXT,
ADD COLUMN "deduplicationKey" TEXT;

UPDATE "PushSubscription" ps SET "recipientRole" = u."role" FROM "User" u WHERE u."id" = ps."customerId";
UPDATE "NotificationPreference" np SET "recipientRole" = u."role" FROM "User" u WHERE u."id" = np."customerId";
UPDATE "WebPushDelivery" wd SET "recipientRole" = u."role" FROM "User" u WHERE u."id" = wd."customerId";

CREATE INDEX "OrganizationCapability_organizationId_status_idx" ON "OrganizationCapability"("organizationId", "status");
CREATE INDEX "OrganizationCapability_key_status_idx" ON "OrganizationCapability"("key", "status");
CREATE UNIQUE INDEX "OrganizationCollaboration_ownerOrgId_partnerOrgId_key" ON "OrganizationCollaboration"("ownerOrgId", "partnerOrgId");
CREATE UNIQUE INDEX "OrganizationCollaboration_unordered_org_pair_key" ON "OrganizationCollaboration"(LEAST("ownerOrgId", "partnerOrgId"), GREATEST("ownerOrgId", "partnerOrgId"));
CREATE INDEX "OrganizationCollaboration_ownerOrgId_status_idx" ON "OrganizationCollaboration"("ownerOrgId", "status");
CREATE INDEX "OrganizationCollaboration_partnerOrgId_status_idx" ON "OrganizationCollaboration"("partnerOrgId", "status");
CREATE INDEX "OrganizationCollaboration_createdAt_idx" ON "OrganizationCollaboration"("createdAt");
CREATE UNIQUE INDEX "OrganizationCollaborationScope_collaborationId_scope_key" ON "OrganizationCollaborationScope"("collaborationId", "scope");
CREATE INDEX "OrganizationCollaborationScope_scope_idx" ON "OrganizationCollaborationScope"("scope");
CREATE INDEX "Order_organizationSlug_estimatedReadyAt_idx" ON "Order"("organizationSlug", "estimatedReadyAt");
CREATE UNIQUE INDEX "OrderReadyTimeHistory_orderId_version_key" ON "OrderReadyTimeHistory"("orderId", "version");
CREATE INDEX "OrderReadyTimeHistory_organizationId_createdAt_idx" ON "OrderReadyTimeHistory"("organizationId", "createdAt");
CREATE INDEX "OrderReadyTimeHistory_changedById_createdAt_idx" ON "OrderReadyTimeHistory"("changedById", "createdAt");
CREATE INDEX "WebPushDelivery_organizationId_deduplicationKey_idx" ON "WebPushDelivery"("organizationId", "deduplicationKey");

ALTER TABLE "OrganizationCapability" ADD CONSTRAINT "OrganizationCapability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationCollaboration" ADD CONSTRAINT "OrganizationCollaboration_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationCollaboration" ADD CONSTRAINT "OrganizationCollaboration_partnerOrgId_fkey" FOREIGN KEY ("partnerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationCollaboration" ADD CONSTRAINT "OrganizationCollaboration_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationCollaboration" ADD CONSTRAINT "OrganizationCollaboration_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationCollaboration" ADD CONSTRAINT "OrganizationCollaboration_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationCollaborationScope" ADD CONSTRAINT "OrganizationCollaborationScope_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "OrganizationCollaboration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReadyTimeHistory" ADD CONSTRAINT "OrderReadyTimeHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReadyTimeHistory" ADD CONSTRAINT "OrderReadyTimeHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReadyTimeHistory" ADD CONSTRAINT "OrderReadyTimeHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
