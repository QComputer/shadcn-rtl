-- Customer Trust & Reputation Foundation

ALTER TYPE "InternalBusinessEntityType" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "BusinessEntityRelationType" ADD VALUE IF NOT EXISTS 'HAS_REVIEW';

CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'PUBLISHED', 'HIDDEN', 'REJECTED');
CREATE TYPE "ReviewSource" AS ENUM ('CUSTOMER_PORTAL', 'REVIEW_REQUEST', 'DEMO', 'IMPORT');
CREATE TYPE "ReviewRequestStatus" AS ENUM ('CREATED', 'SUBMITTED', 'EXPIRED', 'CANCELED');

ALTER TABLE "Review" ADD COLUMN "publicId" TEXT;
ALTER TABLE "Review" ADD COLUMN "title" TEXT;
ALTER TABLE "Review" ADD COLUMN "text" TEXT;
ALTER TABLE "Review" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Review" ADD COLUMN "customerIdentityId" TEXT;
ALTER TABLE "Review" ADD COLUMN "reviewRequestId" TEXT;
ALTER TABLE "Review" ADD COLUMN "businessEventId" TEXT;
ALTER TABLE "Review" ADD COLUMN "customerInteractionId" TEXT;
ALTER TABLE "Review" ADD COLUMN "businessEntityId" TEXT;
ALTER TABLE "Review" ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "Review" ADD COLUMN "source" "ReviewSource" NOT NULL DEFAULT 'CUSTOMER_PORTAL';
ALTER TABLE "Review" ADD COLUMN "verifiedInteraction" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN "contextType" TEXT;
ALTER TABLE "Review" ADD COLUMN "contextId" TEXT;
ALTER TABLE "Review" ADD COLUMN "productId" TEXT;
ALTER TABLE "Review" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "Review" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Review" ADD COLUMN "orderId" TEXT;
ALTER TABLE "Review" ADD COLUMN "staffUserId" TEXT;
ALTER TABLE "Review" ADD COLUMN "responseText" TEXT;
ALTER TABLE "Review" ADD COLUMN "respondedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN "metadata" JSONB;
ALTER TABLE "Review" ALTER COLUMN "userId" DROP NOT NULL;

UPDATE "Review"
SET "publicId" = gen_random_uuid()::text
WHERE "publicId" IS NULL;

UPDATE "Review" r
SET "organizationId" = o."id"
FROM "Organization" o
WHERE r."organizationSlug" = o."slug"
  AND r."organizationId" IS NULL;

ALTER TABLE "Review" ALTER COLUMN "publicId" SET NOT NULL;

CREATE TABLE "ReviewRequest" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerIdentityId" TEXT NOT NULL,
  "businessEventId" TEXT NOT NULL,
  "customerInteractionId" TEXT,
  "tokenHash" TEXT,
  "tokenIssuedAt" TIMESTAMP(3),
  "status" "ReviewRequestStatus" NOT NULL DEFAULT 'CREATED',
  "source" "ReviewSource" NOT NULL DEFAULT 'REVIEW_REQUEST',
  "contextType" TEXT,
  "contextId" TEXT,
  "productId" TEXT,
  "serviceId" TEXT,
  "appointmentId" TEXT,
  "orderId" TEXT,
  "staffUserId" TEXT,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Review_publicId_key" ON "Review"("publicId");
CREATE UNIQUE INDEX "ReviewRequest_publicId_key" ON "ReviewRequest"("publicId");
CREATE UNIQUE INDEX "ReviewRequest_organizationId_businessEventId_customerIdentityId_key" ON "ReviewRequest"("organizationId", "businessEventId", "customerIdentityId");
CREATE UNIQUE INDEX "ReviewRequest_tokenHash_key" ON "ReviewRequest"("tokenHash");

CREATE INDEX "Review_organizationId_status_createdAt_idx" ON "Review"("organizationId", "status", "createdAt");
CREATE INDEX "Review_organizationId_customerIdentityId_createdAt_idx" ON "Review"("organizationId", "customerIdentityId", "createdAt");
CREATE INDEX "Review_organizationId_verifiedInteraction_idx" ON "Review"("organizationId", "verifiedInteraction");
CREATE INDEX "Review_organizationId_contextType_contextId_idx" ON "Review"("organizationId", "contextType", "contextId");
CREATE INDEX "Review_businessEntityId_idx" ON "Review"("businessEntityId");
CREATE INDEX "ReviewRequest_organizationId_status_createdAt_idx" ON "ReviewRequest"("organizationId", "status", "createdAt");
CREATE INDEX "ReviewRequest_organizationId_customerIdentityId_createdAt_idx" ON "ReviewRequest"("organizationId", "customerIdentityId", "createdAt");
CREATE INDEX "ReviewRequest_organizationId_contextType_contextId_idx" ON "ReviewRequest"("organizationId", "contextType", "contextId");

ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_customerIdentityId_organizationId_fkey" FOREIGN KEY ("customerIdentityId", "organizationId") REFERENCES "CustomerIdentity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_businessEventId_fkey" FOREIGN KEY ("businessEventId") REFERENCES "BusinessEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_customerInteractionId_fkey" FOREIGN KEY ("customerInteractionId") REFERENCES "CustomerInteraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerIdentityId_organizationId_fkey" FOREIGN KEY ("customerIdentityId", "organizationId") REFERENCES "CustomerIdentity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewRequestId_fkey" FOREIGN KEY ("reviewRequestId") REFERENCES "ReviewRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessEventId_fkey" FOREIGN KEY ("businessEventId") REFERENCES "BusinessEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerInteractionId_fkey" FOREIGN KEY ("customerInteractionId") REFERENCES "CustomerInteraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessEntityId_organizationId_fkey" FOREIGN KEY ("businessEntityId", "organizationId") REFERENCES "BusinessEntity"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
