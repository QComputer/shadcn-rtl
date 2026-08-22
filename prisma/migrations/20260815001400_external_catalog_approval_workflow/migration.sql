-- Additive external catalog approval workflow and business entity foundation.

ALTER TYPE "ExternalCatalogItemType" ADD VALUE IF NOT EXISTS 'SERVICE';

CREATE TYPE "ExternalImportRunStatus" AS ENUM (
  'PREVIEW',
  'MAPPING',
  'READY_FOR_APPROVAL',
  'APPROVED',
  'IMPORTING',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "ExternalCatalogItemStatus" AS ENUM (
  'DISCOVERED',
  'MAPPED',
  'APPROVED',
  'IMPORTED',
  'REJECTED'
);

CREATE TYPE "ExternalEntityType" AS ENUM (
  'CATEGORY',
  'PRODUCT',
  'SERVICE'
);

CREATE TYPE "InternalBusinessEntityType" AS ENUM (
  'PRODUCT_CATEGORY',
  'PRODUCT',
  'SERVICE',
  'ORGANIZATION',
  'LOCATION',
  'CAMPAIGN',
  'CONTENT'
);

CREATE TYPE "ExternalEntityMappingStatus" AS ENUM (
  'SUGGESTED',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "ExternalCatalogSyncJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'DRY_RUN_COMPLETED',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "ExternalCatalogChangeType" AS ENUM (
  'NEW_ITEM',
  'PRICE_CHANGED',
  'NAME_CHANGED',
  'UNCHANGED'
);

CREATE TYPE "BusinessEntityStatus" AS ENUM (
  'ACTIVE',
  'DRAFT',
  'ARCHIVED'
);

ALTER TABLE "ExternalCatalogItem"
  ADD COLUMN "status" "ExternalCatalogItemStatus" NOT NULL DEFAULT 'DISCOVERED',
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "importedAt" TIMESTAMP(3),
  ADD COLUMN "importedEntityType" "InternalBusinessEntityType",
  ADD COLUMN "importedEntityId" TEXT;

CREATE UNIQUE INDEX "ExternalCatalogItem_id_organizationId_key" ON "ExternalCatalogItem"("id", "organizationId");
CREATE INDEX "ExternalCatalogItem_organizationId_status_idx" ON "ExternalCatalogItem"("organizationId", "status");

CREATE TABLE "ExternalImportRun" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "status" "ExternalImportRunStatus" NOT NULL DEFAULT 'PREVIEW',
  "summary" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalImportRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalImportRun_publicId_key" ON "ExternalImportRun"("publicId");
CREATE INDEX "ExternalImportRun_organizationId_status_idx" ON "ExternalImportRun"("organizationId", "status");
CREATE INDEX "ExternalImportRun_connectionId_startedAt_idx" ON "ExternalImportRun"("connectionId", "startedAt");

CREATE TABLE "ExternalEntityMapping" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "connectionId" TEXT,
  "externalItemId" TEXT,
  "externalSource" TEXT NOT NULL,
  "externalEntityType" "ExternalEntityType" NOT NULL,
  "externalId" TEXT NOT NULL,
  "internalEntityType" "InternalBusinessEntityType" NOT NULL,
  "internalEntityId" TEXT,
  "confidenceScore" DECIMAL(5,4),
  "status" "ExternalEntityMappingStatus" NOT NULL DEFAULT 'SUGGESTED',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalEntityMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalEntityMapping_publicId_key" ON "ExternalEntityMapping"("publicId");
CREATE UNIQUE INDEX "ExternalEntityMapping_organizationId_externalSource_externalEntityType_externalId_internalEntityType_key"
  ON "ExternalEntityMapping"("organizationId", "externalSource", "externalEntityType", "externalId", "internalEntityType");
CREATE INDEX "ExternalEntityMapping_organizationId_status_idx" ON "ExternalEntityMapping"("organizationId", "status");
CREATE INDEX "ExternalEntityMapping_connectionId_status_idx" ON "ExternalEntityMapping"("connectionId", "status");
CREATE INDEX "ExternalEntityMapping_externalItemId_idx" ON "ExternalEntityMapping"("externalItemId");
CREATE INDEX "ExternalEntityMapping_internalEntityType_internalEntityId_idx" ON "ExternalEntityMapping"("internalEntityType", "internalEntityId");

CREATE TABLE "ExternalCatalogSyncJob" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "connectionId" TEXT,
  "source" TEXT NOT NULL,
  "entityType" "ExternalEntityType" NOT NULL,
  "status" "ExternalCatalogSyncJobStatus" NOT NULL DEFAULT 'QUEUED',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "resultSummary" JSONB,
  "errorMessage" TEXT,
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalCatalogSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalCatalogSyncJob_publicId_key" ON "ExternalCatalogSyncJob"("publicId");
CREATE INDEX "ExternalCatalogSyncJob_organizationId_status_idx" ON "ExternalCatalogSyncJob"("organizationId", "status");
CREATE INDEX "ExternalCatalogSyncJob_connectionId_startedAt_idx" ON "ExternalCatalogSyncJob"("connectionId", "startedAt");
CREATE INDEX "ExternalCatalogSyncJob_source_entityType_idx" ON "ExternalCatalogSyncJob"("source", "entityType");

CREATE TABLE "BusinessEntity" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityType" "InternalBusinessEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT,
  "status" "BusinessEntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessEntity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessEntity_publicId_key" ON "BusinessEntity"("publicId");
CREATE UNIQUE INDEX "BusinessEntity_organizationId_entityType_entityId_key" ON "BusinessEntity"("organizationId", "entityType", "entityId");
CREATE INDEX "BusinessEntity_organizationId_entityType_idx" ON "BusinessEntity"("organizationId", "entityType");
CREATE INDEX "BusinessEntity_organizationId_status_idx" ON "BusinessEntity"("organizationId", "status");
CREATE INDEX "BusinessEntity_slug_idx" ON "BusinessEntity"("slug");

ALTER TABLE "ExternalImportRun"
  ADD CONSTRAINT "ExternalImportRun_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ExternalImportRun_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ExternalCatalogConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalEntityMapping"
  ADD CONSTRAINT "ExternalEntityMapping_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ExternalEntityMapping_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ExternalCatalogConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ExternalEntityMapping_externalItemId_organizationId_fkey"
  FOREIGN KEY ("externalItemId", "organizationId") REFERENCES "ExternalCatalogItem"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalCatalogSyncJob"
  ADD CONSTRAINT "ExternalCatalogSyncJob_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ExternalCatalogSyncJob_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ExternalCatalogConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessEntity"
  ADD CONSTRAINT "BusinessEntity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
