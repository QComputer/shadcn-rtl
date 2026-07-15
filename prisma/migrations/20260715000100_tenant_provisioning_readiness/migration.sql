-- BB-B2B-P13: Guided tenant provisioning readiness.
-- Additive only: stores reviewable provisioning plans without creating tenants.

CREATE TYPE "TenantProvisioningPlanStatus" AS ENUM (
  'DRAFT',
  'VALIDATING',
  'NEEDS_REVIEW',
  'READY',
  'APPROVED',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "TenantProvisioningSourceType" AS ENUM (
  'REQUEST_DEMO_LEAD',
  'ONBOARDING_WIZARD',
  'MANUAL'
);

CREATE TABLE "TenantProvisioningPlan" (
  "id" TEXT NOT NULL,
  "requestDemoLeadId" TEXT,
  "sourceType" "TenantProvisioningSourceType" NOT NULL,
  "sourceReference" TEXT,
  "status" "TenantProvisioningPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "idempotencyKey" TEXT NOT NULL,
  "proposedOrganizationType" "OrganizationType" NOT NULL,
  "proposedName" TEXT NOT NULL,
  "proposedSlug" TEXT NOT NULL,
  "proposedDefaultLocale" TEXT NOT NULL DEFAULT 'fa',
  "proposedTimezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
  "proposedCurrency" TEXT,
  "proposedOwnerName" TEXT,
  "proposedOwnerPhone" TEXT,
  "proposedOwnerEmail" TEXT,
  "proposedPackageId" TEXT,
  "proposedModules" JSONB,
  "proposedFeatureFlags" JSONB,
  "proposedSettings" JSONB,
  "proposedDemoContent" BOOLEAN NOT NULL DEFAULT false,
  "proposedCustomDomain" TEXT,
  "validationVersion" INTEGER NOT NULL DEFAULT 0,
  "validationResult" JSONB,
  "validationErrors" JSONB,
  "validatedAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantProvisioningPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantProvisioningPlan_idempotencyKey_key"
  ON "TenantProvisioningPlan"("idempotencyKey");

CREATE UNIQUE INDEX "TenantProvisioningPlan_requestDemoLeadId_sourceType_key"
  ON "TenantProvisioningPlan"("requestDemoLeadId", "sourceType");

CREATE INDEX "TenantProvisioningPlan_requestDemoLeadId_idx"
  ON "TenantProvisioningPlan"("requestDemoLeadId");

CREATE INDEX "TenantProvisioningPlan_sourceType_sourceReference_idx"
  ON "TenantProvisioningPlan"("sourceType", "sourceReference");

CREATE INDEX "TenantProvisioningPlan_status_createdAt_idx"
  ON "TenantProvisioningPlan"("status", "createdAt");

CREATE INDEX "TenantProvisioningPlan_proposedSlug_idx"
  ON "TenantProvisioningPlan"("proposedSlug");

CREATE INDEX "TenantProvisioningPlan_createdAt_idx"
  ON "TenantProvisioningPlan"("createdAt");

ALTER TABLE "TenantProvisioningPlan"
  ADD CONSTRAINT "TenantProvisioningPlan_requestDemoLeadId_fkey"
  FOREIGN KEY ("requestDemoLeadId") REFERENCES "RequestDemoLead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantProvisioningPlan"
  ADD CONSTRAINT "TenantProvisioningPlan_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TenantProvisioningPlan"
  ADD CONSTRAINT "TenantProvisioningPlan_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantProvisioningPlan"
  ADD CONSTRAINT "TenantProvisioningPlan_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
