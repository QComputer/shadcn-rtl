-- BB-B2B-P11: Tenant Custom-domain Onboarding Flow
-- Extends OrganizationDomain model with P11 required fields and enums.

-- Step 1: Add new enum values to DomainStatus (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'DomainStatus' AND e.enumlabel = 'REQUESTED'
  ) THEN
    ALTER TYPE "DomainStatus" ADD VALUE 'REQUESTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'DomainStatus' AND e.enumlabel = 'PROVIDER_PENDING'
  ) THEN
    ALTER TYPE "DomainStatus" ADD VALUE 'PROVIDER_PENDING';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'DomainStatus' AND e.enumlabel = 'ERROR'
  ) THEN
    ALTER TYPE "DomainStatus" ADD VALUE 'ERROR';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'DomainStatus' AND e.enumlabel = 'REMOVAL_PENDING'
  ) THEN
    ALTER TYPE "DomainStatus" ADD VALUE 'REMOVAL_PENDING';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'DomainStatus' AND e.enumlabel = 'REMOVED'
  ) THEN
    ALTER TYPE "DomainStatus" ADD VALUE 'REMOVED';
  END IF;
END $$;

-- Step 2: Create new enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DomainKind') THEN
    CREATE TYPE "DomainKind" AS ENUM ('APEX', 'SUBDOMAIN');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DomainProvider') THEN
    CREATE TYPE "DomainProvider" AS ENUM ('VERCEL');
  END IF;
END $$;

-- Step 3: Update OrganizationDomain table
ALTER TABLE "OrganizationDomain"
  ADD COLUMN IF NOT EXISTS "kind" "DomainKind" NOT NULL DEFAULT 'SUBDOMAIN',
  ADD COLUMN IF NOT EXISTS "provider" "DomainProvider" NOT NULL DEFAULT 'VERCEL',
  ADD COLUMN IF NOT EXISTS "providerVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dnsConfigured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sslReady" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verificationType" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationDomain" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationValue" TEXT,
  ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastErrorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "lastErrorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Step 4: Migrate existing data (PENDING -> REQUESTED, FAILED -> ERROR)
UPDATE "OrganizationDomain"
  SET status = 'REQUESTED'
  WHERE status = 'PENDING';

UPDATE "OrganizationDomain"
  SET status = 'ERROR'
  WHERE status = 'FAILED';

-- Step 5: Add indexes
CREATE INDEX IF NOT EXISTS "OrganizationDomain_normalizedDomain_status_idx"
  ON "OrganizationDomain"("normalizedDomain", "status");

CREATE INDEX IF NOT EXISTS "OrganizationDomain_organizationId_kind_idx"
  ON "OrganizationDomain"("organizationId", "kind");
