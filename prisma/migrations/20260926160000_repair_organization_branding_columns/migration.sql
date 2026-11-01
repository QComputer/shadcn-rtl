-- BB-DB-02: Repair OrganizationBranding schema drift.
-- The branding release (9824f2e) defined additional OrganizationBranding
-- fields in prisma/schema.prisma but the accompanying migration only added
-- applicationName. Production is missing 8 columns, causing P2022 on every
-- custom-domain resolver query that selects the branding relation.
-- This migration is additive and safe: all columns are nullable.

ALTER TABLE "OrganizationBranding"
  ADD COLUMN IF NOT EXISTS "applicationName" TEXT,
  ADD COLUMN IF NOT EXISTS "pwaMaskable192Url" TEXT,
  ADD COLUMN IF NOT EXISTS "pwaMaskable512Url" TEXT,
  ADD COLUMN IF NOT EXISTS "monochromeIconUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "markUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "logoInverseUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "themeColor" TEXT,
  ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);