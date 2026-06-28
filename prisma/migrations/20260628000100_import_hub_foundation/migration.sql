-- Import Hub foundation.
-- Stores seller-initiated external import sources, review jobs, and draft-only imported content.

CREATE TYPE "ExternalImportSourceType" AS ENUM (
  'INSTAGRAM',
  'TELEGRAM',
  'SNAP_FOOD',
  'SNAP_MARKET',
  'CSV',
  'EXCEL',
  'PDF',
  'IMAGE_MENU',
  'MANUAL_URL',
  'MANUAL_TEXT',
  'UNKNOWN'
);

CREATE TYPE "ExternalImportSourceStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'DISABLED',
  'ERROR'
);

CREATE TYPE "ExternalImportJobStatus" AS ENUM (
  'QUEUED',
  'NEEDS_REVIEW',
  'COMPLETED',
  'FAILED',
  'CANCELED'
);

CREATE TYPE "ImportedDraftStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'IMPORTED',
  'MERGED'
);

CREATE TABLE "ExternalImportSource" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "ExternalImportSourceType" NOT NULL,
  "status" "ExternalImportSourceStatus" NOT NULL DEFAULT 'DRAFT',
  "displayName" TEXT,
  "sourceUrl" TEXT,
  "normalizedUrl" TEXT,
  "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "consentText" TEXT,
  "metadata" JSONB,
  "createdByUserId" TEXT,
  "lastImportedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalImportSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalImportJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceId" TEXT,
  "type" "ExternalImportSourceType" NOT NULL,
  "status" "ExternalImportJobStatus" NOT NULL DEFAULT 'QUEUED',
  "inputUrl" TEXT,
  "inputText" TEXT,
  "inputFilename" TEXT,
  "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "consentText" TEXT,
  "errorMessage" TEXT,
  "summary" JSONB,
  "requestedByUserId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportedProductDraft" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT,
  "sourceId" TEXT,
  "status" "ImportedDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "description" TEXT,
  "sku" TEXT,
  "categoryName" TEXT,
  "basePrice" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "imageUrl" TEXT,
  "sourceUrl" TEXT,
  "sourceExternalId" TEXT,
  "sourceMetadata" JSONB,
  "rawData" JSONB,
  "warnings" JSONB,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportedProductDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportedContentDraft" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT,
  "sourceId" TEXT,
  "status" "ImportedDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT,
  "body" TEXT,
  "mediaUrl" TEXT,
  "mediaType" TEXT,
  "sourceUrl" TEXT,
  "sourceExternalId" TEXT,
  "sourceMetadata" JSONB,
  "rawData" JSONB,
  "warnings" JSONB,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportedContentDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalImportSource_organizationId_idx" ON "ExternalImportSource"("organizationId");
CREATE INDEX "ExternalImportSource_organizationId_type_idx" ON "ExternalImportSource"("organizationId", "type");
CREATE INDEX "ExternalImportSource_organizationId_status_idx" ON "ExternalImportSource"("organizationId", "status");
CREATE INDEX "ExternalImportSource_normalizedUrl_idx" ON "ExternalImportSource"("normalizedUrl");
CREATE INDEX "ExternalImportSource_createdByUserId_idx" ON "ExternalImportSource"("createdByUserId");

CREATE INDEX "ExternalImportJob_organizationId_idx" ON "ExternalImportJob"("organizationId");
CREATE INDEX "ExternalImportJob_organizationId_status_idx" ON "ExternalImportJob"("organizationId", "status");
CREATE INDEX "ExternalImportJob_organizationId_type_idx" ON "ExternalImportJob"("organizationId", "type");
CREATE INDEX "ExternalImportJob_sourceId_idx" ON "ExternalImportJob"("sourceId");
CREATE INDEX "ExternalImportJob_requestedByUserId_idx" ON "ExternalImportJob"("requestedByUserId");
CREATE INDEX "ExternalImportJob_createdAt_idx" ON "ExternalImportJob"("createdAt");

CREATE INDEX "ImportedProductDraft_organizationId_idx" ON "ImportedProductDraft"("organizationId");
CREATE INDEX "ImportedProductDraft_organizationId_status_idx" ON "ImportedProductDraft"("organizationId", "status");
CREATE INDEX "ImportedProductDraft_jobId_idx" ON "ImportedProductDraft"("jobId");
CREATE INDEX "ImportedProductDraft_sourceId_idx" ON "ImportedProductDraft"("sourceId");
CREATE INDEX "ImportedProductDraft_reviewedByUserId_idx" ON "ImportedProductDraft"("reviewedByUserId");
CREATE INDEX "ImportedProductDraft_sourceExternalId_idx" ON "ImportedProductDraft"("sourceExternalId");

CREATE INDEX "ImportedContentDraft_organizationId_idx" ON "ImportedContentDraft"("organizationId");
CREATE INDEX "ImportedContentDraft_organizationId_status_idx" ON "ImportedContentDraft"("organizationId", "status");
CREATE INDEX "ImportedContentDraft_jobId_idx" ON "ImportedContentDraft"("jobId");
CREATE INDEX "ImportedContentDraft_sourceId_idx" ON "ImportedContentDraft"("sourceId");
CREATE INDEX "ImportedContentDraft_reviewedByUserId_idx" ON "ImportedContentDraft"("reviewedByUserId");
CREATE INDEX "ImportedContentDraft_sourceExternalId_idx" ON "ImportedContentDraft"("sourceExternalId");

ALTER TABLE "ExternalImportSource"
  ADD CONSTRAINT "ExternalImportSource_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalImportSource"
  ADD CONSTRAINT "ExternalImportSource_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExternalImportJob"
  ADD CONSTRAINT "ExternalImportJob_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalImportJob"
  ADD CONSTRAINT "ExternalImportJob_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "ExternalImportSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExternalImportJob"
  ADD CONSTRAINT "ExternalImportJob_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportedProductDraft"
  ADD CONSTRAINT "ImportedProductDraft_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportedProductDraft"
  ADD CONSTRAINT "ImportedProductDraft_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "ExternalImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportedProductDraft"
  ADD CONSTRAINT "ImportedProductDraft_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "ExternalImportSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportedProductDraft"
  ADD CONSTRAINT "ImportedProductDraft_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportedContentDraft"
  ADD CONSTRAINT "ImportedContentDraft_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportedContentDraft"
  ADD CONSTRAINT "ImportedContentDraft_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "ExternalImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportedContentDraft"
  ADD CONSTRAINT "ImportedContentDraft_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "ExternalImportSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportedContentDraft"
  ADD CONSTRAINT "ImportedContentDraft_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
