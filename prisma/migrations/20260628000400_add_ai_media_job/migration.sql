CREATE TABLE "AiMediaJob" (
    id TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    provider TEXT NOT NULL DEFAULT 'MOCK',
    "errorMessage" TEXT,
    inputs JSONB,
    outputs JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiMediaJob_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "AiMediaJob_jobId_key" ON "AiMediaJob"("jobId");
CREATE INDEX "AiMediaJob_organizationId_idx" ON "AiMediaJob"("organizationId");
CREATE INDEX "AiMediaJob_productId_idx" ON "AiMediaJob"("productId");
CREATE INDEX "AiMediaJob_jobId_idx" ON "AiMediaJob"("jobId");
CREATE INDEX "AiMediaJob_status_idx" ON "AiMediaJob"("status");
