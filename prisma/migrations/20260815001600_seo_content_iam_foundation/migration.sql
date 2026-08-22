-- Additive SEO Content Intelligence + iAM dry-run foundation.

ALTER TYPE "SeoOpportunityType" ADD VALUE 'SERVICE_DESCRIPTION_MISSING';
ALTER TYPE "SeoOpportunityType" ADD VALUE 'BUSINESS_DESCRIPTION_MISSING';

ALTER TYPE "SeoOpportunityStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "SeoOpportunityStatus" ADD VALUE 'CONTENT_REQUESTED';
ALTER TYPE "SeoOpportunityStatus" ADD VALUE 'RESOLVED';

CREATE TYPE "SeoContentType" AS ENUM (
  'LOCAL_LANDING_PAGE',
  'PRODUCT_CONTENT',
  'SERVICE_CONTENT',
  'FAQ',
  'ARTICLE',
  'SOCIAL_POST',
  'VIDEO_SCRIPT',
  'CAMPAIGN_COPY',
  'BUSINESS_DESCRIPTION'
);

CREATE TYPE "SeoContentRequestStatus" AS ENUM (
  'DETECTED',
  'DRAFT',
  'READY_FOR_REVIEW',
  'APPROVED',
  'QUEUED',
  'SENT_TO_PROVIDER',
  'PROVIDER_PROCESSING',
  'RESULT_RECEIVED',
  'REJECTED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "SeoContentApprovalState" AS ENUM (
  'NOT_SUBMITTED',
  'GENERATION_APPROVED',
  'RESULT_REVIEW_REQUIRED',
  'RESULT_APPROVED',
  'PUBLICATION_APPROVED',
  'REJECTED'
);

CREATE TYPE "ContentAssetSource" AS ENUM (
  'INTERNAL',
  'PROVIDER_DRY_RUN',
  'PROVIDER_RESULT',
  'IMPORT',
  'MANUAL'
);

CREATE TYPE "ContentAssetStatus" AS ENUM (
  'DRAFT',
  'REVIEW_REQUIRED',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
  'REJECTED'
);

CREATE TYPE "ContentDistributionTarget" AS ENUM (
  'WEBSITE',
  'INSTAGRAM',
  'FACEBOOK',
  'TELEGRAM',
  'IAM',
  'ICV',
  'EBC'
);

CREATE TYPE "ContentDistributionStatus" AS ENUM (
  'PLANNED',
  'READY',
  'PUBLISHED',
  'FAILED',
  'SYNCED'
);

CREATE UNIQUE INDEX "SeoOpportunity_id_organizationId_key" ON "SeoOpportunity"("id", "organizationId");

CREATE TABLE "SeoContentRequest" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "businessEntityId" TEXT NOT NULL,
  "seoOpportunityId" TEXT,
  "contentType" "SeoContentType" NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'fa',
  "targetKeywords" JSONB,
  "targetLocation" TEXT,
  "status" "SeoContentRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "priority" "SeoOpportunityPriority" NOT NULL DEFAULT 'MEDIUM',
  "approvalState" "SeoContentApprovalState" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "provider" "IntegrationProvider",
  "providerRequestReference" TEXT,
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "resultReceivedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "publicationApprovedByUserId" TEXT,
  "publicationApprovedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeoContentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoContentRequest_publicId_key" ON "SeoContentRequest"("publicId");
CREATE UNIQUE INDEX "SeoContentRequest_id_organizationId_key" ON "SeoContentRequest"("id", "organizationId");
CREATE INDEX "SeoContentRequest_organizationId_status_idx" ON "SeoContentRequest"("organizationId", "status");
CREATE INDEX "SeoContentRequest_organizationId_approvalState_idx" ON "SeoContentRequest"("organizationId", "approvalState");
CREATE INDEX "SeoContentRequest_organizationId_contentType_idx" ON "SeoContentRequest"("organizationId", "contentType");
CREATE INDEX "SeoContentRequest_seoOpportunityId_idx" ON "SeoContentRequest"("seoOpportunityId");
CREATE INDEX "SeoContentRequest_businessEntityId_idx" ON "SeoContentRequest"("businessEntityId");

CREATE TABLE "SeoContentBrief" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contentRequestId" TEXT NOT NULL,
  "businessEntityId" TEXT NOT NULL,
  "contentType" "SeoContentType" NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'fa',
  "contentGoal" TEXT NOT NULL,
  "primaryKeyword" TEXT,
  "secondaryKeywords" JSONB,
  "location" TEXT,
  "audience" TEXT,
  "desiredSchemaType" TEXT,
  "factualContext" JSONB,
  "relatedEntities" JSONB,
  "requiredReferences" JSONB,
  "prohibitedClaims" JSONB,
  "toneHints" JSONB,
  "suggestedTitle" TEXT,
  "suggestedOutline" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeoContentBrief_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoContentBrief_publicId_key" ON "SeoContentBrief"("publicId");
CREATE UNIQUE INDEX "SeoContentBrief_contentRequestId_key" ON "SeoContentBrief"("contentRequestId");
CREATE UNIQUE INDEX "SeoContentBrief_contentRequestId_organizationId_key" ON "SeoContentBrief"("contentRequestId", "organizationId");
CREATE INDEX "SeoContentBrief_organizationId_contentType_idx" ON "SeoContentBrief"("organizationId", "contentType");
CREATE INDEX "SeoContentBrief_businessEntityId_idx" ON "SeoContentBrief"("businessEntityId");

CREATE TABLE "ContentAsset" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contentRequestId" TEXT,
  "businessEntityId" TEXT,
  "source" "ContentAssetSource" NOT NULL DEFAULT 'INTERNAL',
  "contentType" "SeoContentType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'fa',
  "status" "ContentAssetStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceProvider" "IntegrationProvider",
  "providerResultReference" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "schemaType" TEXT,
  "keywords" JSONB,
  "metadata" JSONB,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentAsset_publicId_key" ON "ContentAsset"("publicId");
CREATE UNIQUE INDEX "ContentAsset_id_organizationId_key" ON "ContentAsset"("id", "organizationId");
CREATE INDEX "ContentAsset_organizationId_status_idx" ON "ContentAsset"("organizationId", "status");
CREATE INDEX "ContentAsset_organizationId_contentType_idx" ON "ContentAsset"("organizationId", "contentType");
CREATE INDEX "ContentAsset_contentRequestId_idx" ON "ContentAsset"("contentRequestId");
CREATE INDEX "ContentAsset_businessEntityId_idx" ON "ContentAsset"("businessEntityId");

CREATE TABLE "ContentDistribution" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contentAssetId" TEXT NOT NULL,
  "target" "ContentDistributionTarget" NOT NULL,
  "status" "ContentDistributionStatus" NOT NULL DEFAULT 'PLANNED',
  "provider" "IntegrationProvider",
  "externalReference" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentDistribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentDistribution_publicId_key" ON "ContentDistribution"("publicId");
CREATE UNIQUE INDEX "ContentDistribution_organizationId_contentAssetId_target_key" ON "ContentDistribution"("organizationId", "contentAssetId", "target");
CREATE INDEX "ContentDistribution_organizationId_status_idx" ON "ContentDistribution"("organizationId", "status");
CREATE INDEX "ContentDistribution_organizationId_target_idx" ON "ContentDistribution"("organizationId", "target");
CREATE INDEX "ContentDistribution_contentAssetId_idx" ON "ContentDistribution"("contentAssetId");

ALTER TABLE "SeoContentRequest"
  ADD CONSTRAINT "SeoContentRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoContentRequest_businessEntityId_organizationId_fkey"
  FOREIGN KEY ("businessEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoContentRequest_seoOpportunityId_organizationId_fkey"
  FOREIGN KEY ("seoOpportunityId", "organizationId") REFERENCES "SeoOpportunity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoContentRequest_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoContentRequest_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoContentRequest_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoContentRequest_publicationApprovedByUserId_fkey"
  FOREIGN KEY ("publicationApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoContentBrief"
  ADD CONSTRAINT "SeoContentBrief_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoContentBrief_contentRequestId_organizationId_fkey"
  FOREIGN KEY ("contentRequestId", "organizationId") REFERENCES "SeoContentRequest"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoContentBrief_businessEntityId_organizationId_fkey"
  FOREIGN KEY ("businessEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentAsset"
  ADD CONSTRAINT "ContentAsset_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentAsset_contentRequestId_organizationId_fkey"
  FOREIGN KEY ("contentRequestId", "organizationId") REFERENCES "SeoContentRequest"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentAsset_businessEntityId_organizationId_fkey"
  FOREIGN KEY ("businessEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentAsset_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentAsset_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentDistribution"
  ADD CONSTRAINT "ContentDistribution_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentDistribution_contentAssetId_organizationId_fkey"
  FOREIGN KEY ("contentAssetId", "organizationId") REFERENCES "ContentAsset"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
