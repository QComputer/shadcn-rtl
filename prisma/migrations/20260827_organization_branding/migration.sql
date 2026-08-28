-- CreateOrganizationBrandingSource
CREATE TYPE "OrganizationBrandingSource" AS ENUM ('BAZARBAAZ_MANAGED', 'EXTERNAL_SYNC', 'PLATFORM_FALLBACK');

-- CreateOrganizationBranding
CREATE TABLE "OrganizationBranding" (
  id                        TEXT   NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId"          TEXT   NOT NULL,
  "displayName"             TEXT,
  "shortName"               TEXT,
  "logoUrl"                 TEXT,
  "faviconUrl"              TEXT,
  "appleTouchIconUrl"       TEXT,
  "pwaIcon192Url"           TEXT,
  "pwaIcon512Url"           TEXT,
  "ogImageUrl"              TEXT,
  source                    "OrganizationBrandingSource" NOT NULL DEFAULT 'BAZARBAAZ_MANAGED',
  "externalSourceUrl"       TEXT,
  "externalSourceLastSyncedAt" TIMESTAMP(3),
  "checksumSha256"          TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "OrganizationBranding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationBranding_organizationId_key" ON "OrganizationBranding"("organizationId");
CREATE INDEX "OrganizationBranding_organizationId_idx" ON "OrganizationBranding"("organizationId");

ALTER TABLE "OrganizationBranding" ADD CONSTRAINT "OrganizationBranding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
