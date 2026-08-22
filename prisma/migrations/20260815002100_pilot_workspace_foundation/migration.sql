-- CreateEnum
CREATE TYPE "PilotWorkspaceStatus" AS ENUM ('DISCOVERY', 'ONBOARDING', 'CONFIGURATION', 'READY_FOR_LAUNCH', 'LIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "PilotChecklistCategory" AS ENUM ('BUSINESS_PROFILE', 'CATALOG', 'INTEGRATIONS', 'SEO', 'TRUST', 'LAUNCH');

-- CreateTable
CREATE TABLE "PilotWorkspace" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "PilotWorkspaceStatus" NOT NULL DEFAULT 'DISCOVERY',
    "assignedOperatorId" TEXT,
    "notes" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "completedChecklist" JSONB NOT NULL DEFAULT '[]',
    "readinessSummary" JSONB NOT NULL,
    "seoGrowthPlanner" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PilotWorkspace_organizationId_key" ON "PilotWorkspace"("organizationId");

-- CreateIndex
CREATE INDEX "PilotWorkspace_status_updatedAt_idx" ON "PilotWorkspace"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "PilotWorkspace_assignedOperatorId_idx" ON "PilotWorkspace"("assignedOperatorId");

-- AddForeignKey
ALTER TABLE "PilotWorkspace" ADD CONSTRAINT "PilotWorkspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotWorkspace" ADD CONSTRAINT "PilotWorkspace_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
