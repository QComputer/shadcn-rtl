-- Additive external catalog connector foundation. BazarBaaz catalog remains source of truth.
CREATE TYPE "ExternalCatalogProvider" AS ENUM ('SNAPPFOOD', 'EZY', 'MANUAL_IMPORT', 'FUTURE_PROVIDER');
CREATE TYPE "ExternalCatalogConnectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'ERROR');
CREATE TYPE "ExternalCatalogSyncMode" AS ENUM ('PREVIEW_ONLY', 'MANUAL_APPROVAL');
CREATE TYPE "ExternalCatalogItemType" AS ENUM ('CATEGORY', 'PRODUCT', 'IMAGE', 'OPTION');
CREATE TYPE "ExternalCatalogMappingStatus" AS ENUM ('UNMAPPED', 'MATCHED', 'READY_FOR_IMPORT', 'IMPORTED', 'IGNORED');
CREATE TYPE "CatalogSyncRunStatus" AS ENUM ('QUEUED', 'PREVIEWED', 'COMPLETED', 'FAILED');

CREATE TABLE "ExternalCatalogConnection" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ExternalCatalogProvider" NOT NULL,
    "externalUrl" TEXT,
    "status" "ExternalCatalogConnectionStatus" NOT NULL DEFAULT 'DRAFT',
    "syncMode" "ExternalCatalogSyncMode" NOT NULL DEFAULT 'PREVIEW_ONLY',
    "metadata" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCatalogConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalCatalogItem" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalType" "ExternalCatalogItemType" NOT NULL,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT,
    "mappingStatus" "ExternalCatalogMappingStatus" NOT NULL DEFAULT 'UNMAPPED',
    "rawPayload" JSONB,
    "previewPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogSyncRun" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "CatalogSyncRunStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "changesSummary" JSONB,
    "metadata" JSONB,

    CONSTRAINT "CatalogSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalCatalogConnection_publicId_key" ON "ExternalCatalogConnection"("publicId");
CREATE UNIQUE INDEX "ExternalCatalogConnection_organizationId_provider_externalUrl_key" ON "ExternalCatalogConnection"("organizationId", "provider", "externalUrl");
CREATE INDEX "ExternalCatalogConnection_organizationId_status_idx" ON "ExternalCatalogConnection"("organizationId", "status");
CREATE INDEX "ExternalCatalogConnection_provider_status_idx" ON "ExternalCatalogConnection"("provider", "status");

CREATE UNIQUE INDEX "ExternalCatalogItem_publicId_key" ON "ExternalCatalogItem"("publicId");
CREATE UNIQUE INDEX "ExternalCatalogItem_connectionId_externalId_externalType_key" ON "ExternalCatalogItem"("connectionId", "externalId", "externalType");
CREATE INDEX "ExternalCatalogItem_organizationId_mappingStatus_idx" ON "ExternalCatalogItem"("organizationId", "mappingStatus");
CREATE INDEX "ExternalCatalogItem_connectionId_mappingStatus_idx" ON "ExternalCatalogItem"("connectionId", "mappingStatus");

CREATE UNIQUE INDEX "CatalogSyncRun_publicId_key" ON "CatalogSyncRun"("publicId");
CREATE INDEX "CatalogSyncRun_organizationId_startedAt_idx" ON "CatalogSyncRun"("organizationId", "startedAt");
CREATE INDEX "CatalogSyncRun_connectionId_startedAt_idx" ON "CatalogSyncRun"("connectionId", "startedAt");
CREATE INDEX "CatalogSyncRun_status_startedAt_idx" ON "CatalogSyncRun"("status", "startedAt");

ALTER TABLE "ExternalCatalogConnection"
  ADD CONSTRAINT "ExternalCatalogConnection_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalCatalogItem"
  ADD CONSTRAINT "ExternalCatalogItem_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ExternalCatalogConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogSyncRun"
  ADD CONSTRAINT "CatalogSyncRun_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ExternalCatalogConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
