-- Owner Activation Completion & Guided Setup Flow

CREATE TYPE "OrganizationActivationTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

CREATE TYPE "OrganizationActivationTaskCategory" AS ENUM ('PROFILE', 'OPERATIONS', 'CUSTOMER', 'GROWTH', 'INTEGRATIONS');

CREATE TABLE "OrganizationActivationTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activationPlanId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "OrganizationActivationTaskCategory" NOT NULL,
    "status" "OrganizationActivationTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "targetRoute" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationActivationTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationActivationTask_organizationId_taskKey_key" ON "OrganizationActivationTask"("organizationId", "taskKey");

CREATE INDEX "OrganizationActivationTask_activationPlanId_status_idx" ON "OrganizationActivationTask"("activationPlanId", "status");

CREATE INDEX "OrganizationActivationTask_organizationId_status_idx" ON "OrganizationActivationTask"("organizationId", "status");

CREATE INDEX "OrganizationActivationTask_organizationId_category_status_idx" ON "OrganizationActivationTask"("organizationId", "category", "status");

ALTER TABLE "OrganizationActivationTask"
ADD CONSTRAINT "OrganizationActivationTask_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationActivationTask"
ADD CONSTRAINT "OrganizationActivationTask_activationPlanId_fkey"
FOREIGN KEY ("activationPlanId") REFERENCES "OrganizationActivationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
