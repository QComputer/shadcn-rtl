-- Additive Business Entity Graph + SEO Intelligence Foundation.

ALTER TYPE "InternalBusinessEntityType" ADD VALUE 'CATEGORY';
ALTER TYPE "InternalBusinessEntityType" ADD VALUE 'SOCIAL_POST';
ALTER TYPE "InternalBusinessEntityType" ADD VALUE 'MEDIA';

CREATE TYPE "BusinessEntityRelationType" AS ENUM (
  'HAS_PRODUCT',
  'HAS_SERVICE',
  'LOCATED_AT',
  'HAS_CATEGORY',
  'HAS_CONTENT',
  'HAS_SOCIAL_POST',
  'HAS_MEDIA',
  'PART_OF_CAMPAIGN',
  'RELATED_TO'
);

CREATE TYPE "SeoOpportunityType" AS ENUM (
  'PRODUCT_DESCRIPTION_MISSING',
  'LOCATION_PAGE_MISSING',
  'FAQ_MISSING',
  'IMAGE_MISSING',
  'REVIEW_MISSING',
  'SCHEMA_HINT_MISSING',
  'SOCIAL_CONTENT_MISSING'
);

CREATE TYPE "SeoOpportunityPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TYPE "SeoOpportunityStatus" AS ENUM (
  'OPEN',
  'PLANNED',
  'DISMISSED',
  'COMPLETED'
);

CREATE TYPE "SocialNetwork" AS ENUM (
  'INSTAGRAM',
  'FACEBOOK',
  'OTHER'
);

CREATE TYPE "SocialConnectionStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'DISABLED',
  'ERROR'
);

CREATE TYPE "SocialPostStatus" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE UNIQUE INDEX "BusinessEntity_id_organizationId_key" ON "BusinessEntity"("id", "organizationId");

CREATE TABLE "BusinessEntityRelation" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "targetEntityId" TEXT NOT NULL,
  "relationType" "BusinessEntityRelationType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BusinessEntityRelation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessEntityRelation_publicId_key" ON "BusinessEntityRelation"("publicId");
CREATE UNIQUE INDEX "BusinessEntityRelation_organizationId_sourceEntityId_targetEntityId_relationType_key"
  ON "BusinessEntityRelation"("organizationId", "sourceEntityId", "targetEntityId", "relationType");
CREATE INDEX "BusinessEntityRelation_organizationId_sourceEntityId_idx" ON "BusinessEntityRelation"("organizationId", "sourceEntityId");
CREATE INDEX "BusinessEntityRelation_organizationId_targetEntityId_idx" ON "BusinessEntityRelation"("organizationId", "targetEntityId");
CREATE INDEX "BusinessEntityRelation_organizationId_relationType_idx" ON "BusinessEntityRelation"("organizationId", "relationType");

CREATE TABLE "BusinessEntityMetadata" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "schemaType" TEXT,
  "keywords" JSONB,
  "locale" TEXT NOT NULL DEFAULT 'fa',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessEntityMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessEntityMetadata_publicId_key" ON "BusinessEntityMetadata"("publicId");
CREATE UNIQUE INDEX "BusinessEntityMetadata_organizationId_entityId_locale_key"
  ON "BusinessEntityMetadata"("organizationId", "entityId", "locale");
CREATE INDEX "BusinessEntityMetadata_organizationId_schemaType_idx" ON "BusinessEntityMetadata"("organizationId", "schemaType");
CREATE INDEX "BusinessEntityMetadata_organizationId_locale_idx" ON "BusinessEntityMetadata"("organizationId", "locale");

CREATE TABLE "SeoOpportunity" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "opportunityType" "SeoOpportunityType" NOT NULL,
  "priority" "SeoOpportunityPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "SeoOpportunityStatus" NOT NULL DEFAULT 'OPEN',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeoOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoOpportunity_publicId_key" ON "SeoOpportunity"("publicId");
CREATE UNIQUE INDEX "SeoOpportunity_organizationId_entityId_opportunityType_key"
  ON "SeoOpportunity"("organizationId", "entityId", "opportunityType");
CREATE INDEX "SeoOpportunity_organizationId_status_idx" ON "SeoOpportunity"("organizationId", "status");
CREATE INDEX "SeoOpportunity_organizationId_opportunityType_idx" ON "SeoOpportunity"("organizationId", "opportunityType");
CREATE INDEX "SeoOpportunity_entityId_idx" ON "SeoOpportunity"("entityId");

CREATE TABLE "SocialConnection" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "network" "SocialNetwork" NOT NULL,
  "status" "SocialConnectionStatus" NOT NULL DEFAULT 'DRAFT',
  "handle" TEXT,
  "externalAccountId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialConnection_publicId_key" ON "SocialConnection"("publicId");
CREATE UNIQUE INDEX "SocialConnection_organizationId_network_externalAccountId_key"
  ON "SocialConnection"("organizationId", "network", "externalAccountId");
CREATE INDEX "SocialConnection_organizationId_status_idx" ON "SocialConnection"("organizationId", "status");
CREATE INDEX "SocialConnection_network_status_idx" ON "SocialConnection"("network", "status");

CREATE TABLE "SocialPost" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "connectionId" TEXT,
  "businessEntityId" TEXT,
  "network" "SocialNetwork" NOT NULL,
  "externalPostId" TEXT,
  "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
  "caption" TEXT,
  "mediaUrls" JSONB,
  "publishedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialPost_publicId_key" ON "SocialPost"("publicId");
CREATE UNIQUE INDEX "SocialPost_organizationId_network_externalPostId_key"
  ON "SocialPost"("organizationId", "network", "externalPostId");
CREATE INDEX "SocialPost_organizationId_status_idx" ON "SocialPost"("organizationId", "status");
CREATE INDEX "SocialPost_businessEntityId_idx" ON "SocialPost"("businessEntityId");
CREATE INDEX "SocialPost_connectionId_idx" ON "SocialPost"("connectionId");

ALTER TABLE "BusinessEntityRelation"
  ADD CONSTRAINT "BusinessEntityRelation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BusinessEntityRelation_sourceEntityId_organizationId_fkey"
  FOREIGN KEY ("sourceEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BusinessEntityRelation_targetEntityId_organizationId_fkey"
  FOREIGN KEY ("targetEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessEntityMetadata"
  ADD CONSTRAINT "BusinessEntityMetadata_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BusinessEntityMetadata_entityId_organizationId_fkey"
  FOREIGN KEY ("entityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoOpportunity"
  ADD CONSTRAINT "SeoOpportunity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SeoOpportunity_entityId_organizationId_fkey"
  FOREIGN KEY ("entityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialConnection"
  ADD CONSTRAINT "SocialConnection_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialPost"
  ADD CONSTRAINT "SocialPost_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SocialPost_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SocialPost_businessEntityId_organizationId_fkey"
  FOREIGN KEY ("businessEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
