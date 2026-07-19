-- BB-DB-01: normalize Prisma schema vs migration-chain drift.
-- This forward migration preserves data and converges the schema produced by
-- `prisma migrate deploy` with the canonical `prisma/schema.prisma`.

-- 1) ImageAccess enum + Image.access column + index.
-- Prisma schema is authoritative: upload code persists PUBLIC/PRIVATE access
-- metadata, while the migration chain never created the enum/column.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImageAccess') THEN
    CREATE TYPE "ImageAccess" AS ENUM ('PUBLIC', 'PRIVATE');
  END IF;
END $$;

ALTER TABLE "Image"
  ADD COLUMN IF NOT EXISTS "access" "ImageAccess" NOT NULL DEFAULT 'PUBLIC';

CREATE INDEX IF NOT EXISTS "Image_access_idx" ON "Image"("access");

-- 2) DomainStatus enum normalization.
-- 20260715000200_custom_domain_status_backfill maps legacy PENDING->REQUESTED
-- and FAILED->ERROR before this migration. If either legacy value remains in
-- data, the cast below fails instead of guessing or deleting rows.
ALTER TYPE "DomainStatus" RENAME TO "DomainStatus_old";

CREATE TYPE "DomainStatus" AS ENUM (
  'REQUESTED',
  'PROVIDER_PENDING',
  'DNS_REQUIRED',
  'VERIFYING',
  'ACTIVE',
  'ERROR',
  'DISABLED',
  'REMOVAL_PENDING',
  'REMOVED'
);

ALTER TABLE "OrganizationDomain" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OrganizationDomain" ALTER COLUMN "status" TYPE "DomainStatus" USING ("status"::text::"DomainStatus");
ALTER TABLE "OrganizationDomain" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

DROP TYPE "DomainStatus_old";

-- 3) OrganizationDomain ownership foreign keys.
-- Existing orphan values are not silently repaired; adding these constraints
-- fails if data violates the intended nullable User ownership relation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationDomain_createdById_fkey') THEN
    ALTER TABLE "OrganizationDomain"
      ADD CONSTRAINT "OrganizationDomain_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationDomain_updatedById_fkey') THEN
    ALTER TABLE "OrganizationDomain"
      ADD CONSTRAINT "OrganizationDomain_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationDomain_reviewedById_fkey') THEN
    ALTER TABLE "OrganizationDomain"
      ADD CONSTRAINT "OrganizationDomain_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) SmsDelivery.customerId FK action.
-- The column is nullable and the Prisma relation is onDelete: SetNull.
ALTER TABLE "SmsDelivery" DROP CONSTRAINT IF EXISTS "SmsDelivery_customerId_fkey";
ALTER TABLE "SmsDelivery"
  ADD CONSTRAINT "SmsDelivery_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) NotificationDeliveryAttempt timestamp precision + defaults.
-- Prisma schema uses TIMESTAMP(3); updatedAt is application-managed.
ALTER TABLE "NotificationDeliveryAttempt" ALTER COLUMN "nextRetryAt" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "NotificationDeliveryAttempt" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "NotificationDeliveryAttempt" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "NotificationDeliveryAttempt" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- 6) SmsDelivery.updatedAt default.
-- Prisma schema uses @updatedAt rather than a database default.
ALTER TABLE "SmsDelivery" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- 7) Naming-only index drift. Definitions are identical; rename instead of
-- dropping/rebuilding indexes. If an environment already has the canonical
-- name, leave it alone.
DO $$
BEGIN
  IF to_regclass('"AiMediaUsageQuote_organizationId_requestedByUserId_createdAt_id"') IS NOT NULL
     AND to_regclass('"AiMediaUsageQuote_organizationId_requestedByUserId_createdA_idx"') IS NULL THEN
    ALTER INDEX "AiMediaUsageQuote_organizationId_requestedByUserId_createdAt_id"
      RENAME TO "AiMediaUsageQuote_organizationId_requestedByUserId_createdA_idx";
  END IF;

  IF to_regclass('"CustomerSegmentSnapshot_organizationId_segmentKey_calculatedAt_"') IS NOT NULL
     AND to_regclass('"CustomerSegmentSnapshot_organizationId_segmentKey_calculate_idx"') IS NULL THEN
    ALTER INDEX "CustomerSegmentSnapshot_organizationId_segmentKey_calculatedAt_"
      RENAME TO "CustomerSegmentSnapshot_organizationId_segmentKey_calculate_idx";
  END IF;

  IF to_regclass('"NotificationPermissionEvent_organizationId_customerId_createdAt"') IS NOT NULL
     AND to_regclass('"NotificationPermissionEvent_organizationId_customerId_creat_idx"') IS NULL THEN
    ALTER INDEX "NotificationPermissionEvent_organizationId_customerId_createdAt"
      RENAME TO "NotificationPermissionEvent_organizationId_customerId_creat_idx";
  END IF;

  IF to_regclass('"NotificationPreference_organizationId_channel_marketingEnabled_"') IS NOT NULL
     AND to_regclass('"NotificationPreference_organizationId_channel_marketingEnab_idx"') IS NULL THEN
    ALTER INDEX "NotificationPreference_organizationId_channel_marketingEnabled_"
      RENAME TO "NotificationPreference_organizationId_channel_marketingEnab_idx";
  END IF;

  IF to_regclass('"WorkerContributionMirror_organizationId_providerContributionId_"') IS NOT NULL
     AND to_regclass('"WorkerContributionMirror_organizationId_providerContributio_key"') IS NULL THEN
    ALTER INDEX "WorkerContributionMirror_organizationId_providerContributionId_"
      RENAME TO "WorkerContributionMirror_organizationId_providerContributio_key";
  END IF;
END $$;
