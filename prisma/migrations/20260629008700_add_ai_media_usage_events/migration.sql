CREATE TABLE "AiMediaUsageEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "jobId" TEXT,
    "requestedByUserId" TEXT,
    "action" TEXT NOT NULL,
    "provider" TEXT,
    "status" TEXT,
    "units" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMediaUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiMediaUsageEvent_organizationId_idx" ON "AiMediaUsageEvent"("organizationId");
CREATE INDEX "AiMediaUsageEvent_organizationId_createdAt_idx" ON "AiMediaUsageEvent"("organizationId", "createdAt");
CREATE INDEX "AiMediaUsageEvent_jobId_idx" ON "AiMediaUsageEvent"("jobId");
CREATE INDEX "AiMediaUsageEvent_action_idx" ON "AiMediaUsageEvent"("action");
