-- CreateEnum
CREATE TYPE "BusinessGrowthProfileStatus" AS ENUM ('DRAFT', 'ACTIVE', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KeywordIntent" AS ENUM ('INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'LOCAL');

-- CreateEnum
CREATE TYPE "KeywordClusterSource" AS ENUM ('OWNER_INPUT', 'INDUSTRY_TEMPLATE', 'AI_SUGGESTION', 'FUTURE_GOOGLE_TRENDS');

-- CreateEnum
CREATE TYPE "KeywordClusterStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'DISMISSED', 'USED');

-- CreateEnum
CREATE TYPE "GrowthRecommendationType" AS ENUM ('SEO_ACTION', 'IAM_RECOMMENDATION', 'CONTENT_BLUEPRINT', 'TRUST_ACTION', 'ENGAGEMENT_ACTION');

-- CreateEnum
CREATE TYPE "GrowthRecommendationStatus" AS ENUM ('PROPOSED', 'PLANNED', 'ACCEPTED', 'DISMISSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "BusinessGrowthProfile" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "BusinessGrowthProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryGoals" JSONB NOT NULL DEFAULT '[]',
    "targetAudience" JSONB NOT NULL DEFAULT '[]',
    "preferredKeywords" JSONB NOT NULL DEFAULT '[]',
    "preferredLocations" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessGrowthProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordCluster" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileId" TEXT,
    "relatedEntityId" TEXT,
    "keyword" TEXT NOT NULL,
    "intent" "KeywordIntent" NOT NULL,
    "priority" "SeoOpportunityPriority" NOT NULL DEFAULT 'MEDIUM',
    "source" "KeywordClusterSource" NOT NULL,
    "status" "KeywordClusterStatus" NOT NULL DEFAULT 'PROPOSED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthRecommendation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileId" TEXT,
    "keywordClusterId" TEXT,
    "seoOpportunityId" TEXT,
    "businessEntityId" TEXT,
    "recommendationType" "GrowthRecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" "SeoOpportunityPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "GrowthRecommendationStatus" NOT NULL DEFAULT 'PROPOSED',
    "relatedKeywords" JSONB NOT NULL DEFAULT '[]',
    "relatedEntities" JSONB NOT NULL DEFAULT '[]',
    "iamRecommendation" JSONB,
    "contentBlueprint" JSONB,
    "futureIntegrationHooks" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessGrowthProfile_publicId_key" ON "BusinessGrowthProfile"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessGrowthProfile_organizationId_key" ON "BusinessGrowthProfile"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessGrowthProfile_status_updatedAt_idx" ON "BusinessGrowthProfile"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordCluster_publicId_key" ON "KeywordCluster"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordCluster_organizationId_keyword_intent_key" ON "KeywordCluster"("organizationId", "keyword", "intent");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordCluster_id_organizationId_key" ON "KeywordCluster"("id", "organizationId");

-- CreateIndex
CREATE INDEX "KeywordCluster_organizationId_status_idx" ON "KeywordCluster"("organizationId", "status");

-- CreateIndex
CREATE INDEX "KeywordCluster_organizationId_intent_idx" ON "KeywordCluster"("organizationId", "intent");

-- CreateIndex
CREATE INDEX "KeywordCluster_organizationId_source_idx" ON "KeywordCluster"("organizationId", "source");

-- CreateIndex
CREATE INDEX "KeywordCluster_profileId_idx" ON "KeywordCluster"("profileId");

-- CreateIndex
CREATE INDEX "KeywordCluster_relatedEntityId_idx" ON "KeywordCluster"("relatedEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthRecommendation_publicId_key" ON "GrowthRecommendation"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthRecommendation_organizationId_recommendationType_title_key" ON "GrowthRecommendation"("organizationId", "recommendationType", "title");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthRecommendation_id_organizationId_key" ON "GrowthRecommendation"("id", "organizationId");

-- CreateIndex
CREATE INDEX "GrowthRecommendation_organizationId_status_idx" ON "GrowthRecommendation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "GrowthRecommendation_organizationId_recommendationType_idx" ON "GrowthRecommendation"("organizationId", "recommendationType");

-- CreateIndex
CREATE INDEX "GrowthRecommendation_organizationId_priority_idx" ON "GrowthRecommendation"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "GrowthRecommendation_profileId_idx" ON "GrowthRecommendation"("profileId");

-- CreateIndex
CREATE INDEX "GrowthRecommendation_keywordClusterId_idx" ON "GrowthRecommendation"("keywordClusterId");

-- CreateIndex
CREATE INDEX "GrowthRecommendation_seoOpportunityId_idx" ON "GrowthRecommendation"("seoOpportunityId");

-- CreateIndex
CREATE INDEX "GrowthRecommendation_businessEntityId_idx" ON "GrowthRecommendation"("businessEntityId");

-- AddForeignKey
ALTER TABLE "BusinessGrowthProfile" ADD CONSTRAINT "BusinessGrowthProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordCluster" ADD CONSTRAINT "KeywordCluster_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordCluster" ADD CONSTRAINT "KeywordCluster_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BusinessGrowthProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordCluster" ADD CONSTRAINT "KeywordCluster_relatedEntityId_organizationId_fkey" FOREIGN KEY ("relatedEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BusinessGrowthProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_keywordClusterId_organizationId_fkey" FOREIGN KEY ("keywordClusterId", "organizationId") REFERENCES "KeywordCluster"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_seoOpportunityId_organizationId_fkey" FOREIGN KEY ("seoOpportunityId", "organizationId") REFERENCES "SeoOpportunity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_businessEntityId_organizationId_fkey" FOREIGN KEY ("businessEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
