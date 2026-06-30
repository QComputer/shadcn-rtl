-- Phase 108: Creative Studio server foundation.
-- Local ownership, draft asset, and usage records only. No provider calls or public asset mutation.

CREATE TYPE "CreativeStudioTargetType" AS ENUM (
  'PRODUCT',
  'CAMPAIGN',
  'FANPAGE_POST',
  'ORGANIZATION_BRAND',
  'IMPORTED_MEDIA'
);

CREATE TYPE "CreativeStudioAssetType" AS ENUM (
  'PRODUCT_IMAGE',
  'CAMPAIGN_IMAGE',
  'FANPAGE_IMAGE',
  'LOGO',
  'COVER',
  'OG_IMAGE',
  'IMPORT_MEDIA'
);

CREATE TYPE "CreativeStudioJobStatus" AS ENUM (
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELED'
);

CREATE TYPE "CreativeStudioAssetStatus" AS ENUM (
  'DRAFT',
  'SELECTED',
  'APPLIED',
  'REJECTED'
);

CREATE TYPE "CreativeStudioUsageAction" AS ENUM (
  'JOB_CREATED',
  'JOB_CANCELED',
  'ASSET_DRAFTED',
  'ASSET_SELECTED',
  'ASSET_APPLIED'
);

CREATE TABLE "CreativeStudioJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "targetType" "CreativeStudioTargetType" NOT NULL,
  "targetId" TEXT,
  "requestedByUserId" TEXT,
  "status" "CreativeStudioJobStatus" NOT NULL DEFAULT 'QUEUED',
  "provider" TEXT NOT NULL DEFAULT 'MOCK',
  "prompt" TEXT,
  "inputs" JSONB,
  "outputCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "costEstimateCents" INTEGER NOT NULL DEFAULT 0,
  "paidProviderEnabled" BOOLEAN NOT NULL DEFAULT false,
  "rollbackPaused" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CreativeStudioJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeStudioAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "assetType" "CreativeStudioAssetType" NOT NULL,
  "status" "CreativeStudioAssetStatus" NOT NULL DEFAULT 'DRAFT',
  "draftUrl" TEXT,
  "storedUrl" TEXT,
  "sourceUrl" TEXT,
  "mimeType" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "sourceMetadata" JSONB,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CreativeStudioAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreativeStudioUsageEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT,
  "assetId" TEXT,
  "requestedByUserId" TEXT,
  "action" "CreativeStudioUsageAction" NOT NULL,
  "provider" TEXT,
  "targetType" "CreativeStudioTargetType",
  "targetId" TEXT,
  "units" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CreativeStudioUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreativeStudioJob_organizationId_idx" ON "CreativeStudioJob"("organizationId");
CREATE INDEX "CreativeStudioJob_organizationId_status_createdAt_idx" ON "CreativeStudioJob"("organizationId", "status", "createdAt");
CREATE INDEX "CreativeStudioJob_targetType_targetId_idx" ON "CreativeStudioJob"("targetType", "targetId");
CREATE INDEX "CreativeStudioJob_requestedByUserId_idx" ON "CreativeStudioJob"("requestedByUserId");

CREATE INDEX "CreativeStudioAsset_organizationId_idx" ON "CreativeStudioAsset"("organizationId");
CREATE INDEX "CreativeStudioAsset_jobId_idx" ON "CreativeStudioAsset"("jobId");
CREATE INDEX "CreativeStudioAsset_organizationId_status_createdAt_idx" ON "CreativeStudioAsset"("organizationId", "status", "createdAt");
CREATE INDEX "CreativeStudioAsset_assetType_idx" ON "CreativeStudioAsset"("assetType");

CREATE INDEX "CreativeStudioUsageEvent_organizationId_idx" ON "CreativeStudioUsageEvent"("organizationId");
CREATE INDEX "CreativeStudioUsageEvent_organizationId_createdAt_idx" ON "CreativeStudioUsageEvent"("organizationId", "createdAt");
CREATE INDEX "CreativeStudioUsageEvent_jobId_idx" ON "CreativeStudioUsageEvent"("jobId");
CREATE INDEX "CreativeStudioUsageEvent_assetId_idx" ON "CreativeStudioUsageEvent"("assetId");
CREATE INDEX "CreativeStudioUsageEvent_action_idx" ON "CreativeStudioUsageEvent"("action");
CREATE INDEX "CreativeStudioUsageEvent_targetType_targetId_idx" ON "CreativeStudioUsageEvent"("targetType", "targetId");

ALTER TABLE "CreativeStudioAsset"
  ADD CONSTRAINT "CreativeStudioAsset_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "CreativeStudioJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreativeStudioUsageEvent"
  ADD CONSTRAINT "CreativeStudioUsageEvent_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "CreativeStudioJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreativeStudioUsageEvent"
  ADD CONSTRAINT "CreativeStudioUsageEvent_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "CreativeStudioAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
