-- H3-B0: Business Vertical persistence.
--
-- Additive and non-destructive:
--   * adds an OPTIONAL `vertical` column to Organization
--   * adds the HOTEL_BOOKING value to the capability key enum
--
-- Deliberately NOT included:
--   * No backfill. Existing organizations stay NULL rather than being
--     classified by inference. Legacy `SHOP` maps to five possible verticals
--     and legacy `APPOINTMENT` to four, so any inferred value would be a guess.
--   * No CHECK constraint on `vertical`. It is deliberately TEXT rather than an
--     enum so a newer deploy can write a vertical an older deploy has never
--     heard of. Application validation is the single source of truth
--     (lib/business-verticals.ts -> parseBusinessVertical).
--   * No change to OrganizationType. Its behaviour is untouched.
--
-- Safe to apply BEFORE the new application code is deployed: an older binary
-- neither selects nor writes this column.

-- AlterEnum
ALTER TYPE "OrganizationCapabilityKey" ADD VALUE 'HOTEL_BOOKING';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "vertical" TEXT;

-- Partial index: the column is nullable and low-cardinality, so a full index
-- would carry dead entries for the (current) majority of organizations that
-- have no vertical assigned. Supports onboarding/analytics grouping queries
-- without indexing NULLs.
CREATE INDEX "Organization_vertical_idx" ON "Organization"("vertical") WHERE "vertical" IS NOT NULL;
