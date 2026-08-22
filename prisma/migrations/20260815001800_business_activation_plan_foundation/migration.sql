CREATE TYPE "OrganizationActivationPlanStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TABLE "OrganizationActivationPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "industryKey" "OrganizationIndustryKey" NOT NULL,
  "status" "OrganizationActivationPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "generatedFromTemplate" TEXT NOT NULL,
  "recommendedActions" JSONB NOT NULL,
  "completedActions" JSONB NOT NULL DEFAULT '[]',
  "growthOpportunities" JSONB NOT NULL,
  "ownerOnboardingReadModel" JSONB NOT NULL,
  "metadata" JSONB,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationActivationPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationActivationPlan_organizationId_key" ON "OrganizationActivationPlan"("organizationId");
CREATE INDEX "OrganizationActivationPlan_industryKey_status_idx" ON "OrganizationActivationPlan"("industryKey", "status");
CREATE INDEX "OrganizationActivationPlan_status_updatedAt_idx" ON "OrganizationActivationPlan"("status", "updatedAt");

ALTER TABLE "OrganizationActivationPlan"
  ADD CONSTRAINT "OrganizationActivationPlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
