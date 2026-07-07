-- Phase BB-B2B-P10: Request-demo lead storage and admin review.
-- Public lead capture endpoint and SUPER_ADMIN-only review workflow.
-- No SMS side effects. No tenant auto-creation.

CREATE TYPE "RequestDemoLeadStatus" AS ENUM (
  'NEW',
  'REVIEWED',
  'CONTACTED',
  'QUALIFIED',
  'REJECTED',
  'ARCHIVED'
);

CREATE TABLE "RequestDemoLead" (
  "id" TEXT NOT NULL,
  "status" "RequestDemoLeadStatus" NOT NULL DEFAULT 'NEW',
  "source" TEXT DEFAULT 'request-demo',
  "locale" TEXT NOT NULL DEFAULT 'fa',

  "fullName" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "businessType" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "city" TEXT,
  "preferredContactTime" TEXT,
  "needSummary" TEXT,

  "consentAccepted" BOOLEAN NOT NULL DEFAULT false,

  "ipHash" TEXT,
  "userAgentHash" TEXT,

  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "adminNote" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RequestDemoLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequestDemoLead_status_createdAt_idx" ON "RequestDemoLead"("status", "createdAt");
CREATE INDEX "RequestDemoLead_source_idx" ON "RequestDemoLead"("source");
CREATE INDEX "RequestDemoLead_createdAt_idx" ON "RequestDemoLead"("createdAt");
CREATE INDEX "RequestDemoLead_reviewedById_idx" ON "RequestDemoLead"("reviewedById");

ALTER TABLE "RequestDemoLead"
  ADD CONSTRAINT "RequestDemoLead_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
