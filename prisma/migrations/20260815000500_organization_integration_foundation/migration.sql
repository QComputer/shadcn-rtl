-- Additive Organization OS integration foundation.
-- Existing INOTI_USSD records remain valid and default to the USSD integration type.

ALTER TYPE "OrganizationCapabilityKey" ADD VALUE IF NOT EXISTS 'CRM';
ALTER TYPE "OrganizationCapabilityKey" ADD VALUE IF NOT EXISTS 'USSD';
ALTER TYPE "OrganizationCapabilityKey" ADD VALUE IF NOT EXISTS 'LOYALTY';
ALTER TYPE "OrganizationCapabilityKey" ADD VALUE IF NOT EXISTS 'IAM';
ALTER TYPE "OrganizationCapabilityKey" ADD VALUE IF NOT EXISTS 'ICV';
ALTER TYPE "OrganizationCapabilityKey" ADD VALUE IF NOT EXISTS 'EBC';
ALTER TYPE "OrganizationCapabilityKey" ADD VALUE IF NOT EXISTS 'SMS';

ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'INOTI_IMENU';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'INOTI_ICV';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'INOTI_IAM';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'INOTI_EBC';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'SMS';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'OTHER';

CREATE TYPE "IntegrationType" AS ENUM ('IMENU', 'ICV', 'IAM', 'EBC', 'USSD', 'PAYMENT', 'SMS', 'OTHER');

ALTER TABLE "OrganizationIntegration"
  ADD COLUMN "type" "IntegrationType" NOT NULL DEFAULT 'USSD',
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "externalAccountId" TEXT;

CREATE TABLE "OrganizationIntegrationCapability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "capabilityKey" "OrganizationCapabilityKey" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationIntegrationCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationIntegrationCapability_integrationId_capabilityKey_key"
  ON "OrganizationIntegrationCapability"("integrationId", "capabilityKey");
CREATE INDEX "OrganizationIntegrationCapability_organizationId_capabilityKey_idx"
  ON "OrganizationIntegrationCapability"("organizationId", "capabilityKey");
CREATE INDEX "OrganizationIntegration_type_status_idx"
  ON "OrganizationIntegration"("type", "status");

ALTER TABLE "OrganizationIntegrationCapability"
  ADD CONSTRAINT "OrganizationIntegrationCapability_organizationId_capabilityKey_fkey"
  FOREIGN KEY ("organizationId", "capabilityKey") REFERENCES "OrganizationCapability"("organizationId", "key") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OrganizationIntegrationCapability_integrationId_organizationId_fkey"
  FOREIGN KEY ("integrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
