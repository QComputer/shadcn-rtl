-- Rollback BB-B2B-P11: Tenant Custom-domain Onboarding Flow
-- Reverts the OrganizationDomain model extension.

-- Remove indexes
DROP INDEX IF EXISTS "OrganizationDomain_organizationId_kind_idx";
DROP INDEX IF EXISTS "OrganizationDomain_normalizedDomain_status_idx";

-- Remove added columns
ALTER TABLE "OrganizationDomain"
  DROP COLUMN IF EXISTS "kind",
  DROP COLUMN IF EXISTS "provider",
  DROP COLUMN IF EXISTS "providerVerified",
  DROP COLUMN IF EXISTS "dnsConfigured",
  DROP COLUMN IF EXISTS "sslReady",
  DROP COLUMN IF EXISTS "verificationType",
  DROP COLUMN IF EXISTS "verificationDomain",
  DROP COLUMN IF EXISTS "verificationValue",
  DROP COLUMN IF EXISTS "activatedAt",
  DROP COLUMN IF EXISTS "disabledAt",
  DROP COLUMN IF EXISTS "removedAt",
  DROP COLUMN IF EXISTS "reviewedAt",
  DROP COLUMN IF EXISTS "lastErrorCode",
  DROP COLUMN IF EXISTS "lastErrorMessage",
  DROP COLUMN IF EXISTS "createdById",
  DROP COLUMN IF EXISTS "updatedById",
  DROP COLUMN IF EXISTS "reviewedById",
  DROP COLUMN IF EXISTS "deletedAt";

-- Drop new enums
DROP TYPE IF EXISTS "DomainProvider";
DROP TYPE IF EXISTS "DomainKind";

-- Remove new enum values from DomainStatus
-- Note: Cannot easily drop enum values in standard PostgreSQL
-- If rollback is needed, manual enum recreation may be required
