-- Shop custom-domain routing foundation.
-- Maps verified external domains such as example.ir to active SHOP organizations.

CREATE TYPE "DomainType" AS ENUM ('PLATFORM_SUBDOMAIN', 'CUSTOM');
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'DNS_REQUIRED', 'VERIFYING', 'ACTIVE', 'FAILED', 'DISABLED');

CREATE TABLE "OrganizationDomain" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "normalizedDomain" TEXT NOT NULL,
  "type" "DomainType" NOT NULL DEFAULT 'CUSTOM',
  "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "vercelProjectDomainId" TEXT,
  "verificationToken" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationDomain_domain_key" ON "OrganizationDomain"("domain");
CREATE UNIQUE INDEX "OrganizationDomain_normalizedDomain_key" ON "OrganizationDomain"("normalizedDomain");
CREATE INDEX "OrganizationDomain_organizationId_idx" ON "OrganizationDomain"("organizationId");
CREATE INDEX "OrganizationDomain_status_idx" ON "OrganizationDomain"("status");
CREATE INDEX "OrganizationDomain_isPrimary_idx" ON "OrganizationDomain"("isPrimary");
CREATE INDEX "OrganizationDomain_organizationId_status_idx" ON "OrganizationDomain"("organizationId", "status");
CREATE UNIQUE INDEX "OrganizationDomain_one_primary_per_organization" ON "OrganizationDomain"("organizationId") WHERE "isPrimary" = true;

ALTER TABLE "OrganizationDomain"
  ADD CONSTRAINT "OrganizationDomain_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
