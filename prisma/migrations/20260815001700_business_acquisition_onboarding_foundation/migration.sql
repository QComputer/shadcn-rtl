-- Business Acquisition & Onboarding Foundation

CREATE TYPE "OrganizationAcquisitionSourceType" AS ENUM (
  'BAZARBAAZ_TEAM',
  'SALES_AGENT',
  'BUSINESS_SELF_SIGNUP',
  'INVITATION_CODE'
);

CREATE TYPE "OrganizationIndustryKey" AS ENUM (
  'RESTAURANT',
  'PHARMACY',
  'DENTAL_CLINIC',
  'FASHION_BOUTIQUE',
  'RETAIL_SHOP',
  'OTHER'
);

CREATE TYPE "OrganizationInvitationStatus" AS ENUM (
  'CREATED',
  'SENT',
  'CLAIMED',
  'EXPIRED',
  'REVOKED'
);

CREATE TYPE "OrganizationClaimRequestStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "OrganizationAcquisition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceType" "OrganizationAcquisitionSourceType" NOT NULL,
  "industryKey" "OrganizationIndustryKey" NOT NULL,
  "createdByUserId" TEXT,
  "agentUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationAcquisition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInvitation" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invitedRole" "UserRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'CREATED',
  "createdByUserId" TEXT,
  "claimedByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationClaimRequest" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterUserId" TEXT,
  "requesterEmail" TEXT,
  "requesterPhone" TEXT,
  "status" "OrganizationClaimRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "verificationMetadata" JSONB,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationClaimRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationAcquisition_organizationId_key" ON "OrganizationAcquisition"("organizationId");
CREATE INDEX "OrganizationAcquisition_sourceType_createdAt_idx" ON "OrganizationAcquisition"("sourceType", "createdAt");
CREATE INDEX "OrganizationAcquisition_industryKey_idx" ON "OrganizationAcquisition"("industryKey");
CREATE INDEX "OrganizationAcquisition_createdByUserId_idx" ON "OrganizationAcquisition"("createdByUserId");
CREATE INDEX "OrganizationAcquisition_agentUserId_idx" ON "OrganizationAcquisition"("agentUserId");

CREATE UNIQUE INDEX "OrganizationInvitation_publicId_key" ON "OrganizationInvitation"("publicId");
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");
CREATE INDEX "OrganizationInvitation_organizationId_status_idx" ON "OrganizationInvitation"("organizationId", "status");
CREATE INDEX "OrganizationInvitation_expiresAt_idx" ON "OrganizationInvitation"("expiresAt");
CREATE INDEX "OrganizationInvitation_createdByUserId_idx" ON "OrganizationInvitation"("createdByUserId");
CREATE INDEX "OrganizationInvitation_claimedByUserId_idx" ON "OrganizationInvitation"("claimedByUserId");

CREATE UNIQUE INDEX "OrganizationClaimRequest_publicId_key" ON "OrganizationClaimRequest"("publicId");
CREATE INDEX "OrganizationClaimRequest_organizationId_status_idx" ON "OrganizationClaimRequest"("organizationId", "status");
CREATE INDEX "OrganizationClaimRequest_requesterUserId_idx" ON "OrganizationClaimRequest"("requesterUserId");
CREATE INDEX "OrganizationClaimRequest_reviewedByUserId_idx" ON "OrganizationClaimRequest"("reviewedByUserId");

ALTER TABLE "OrganizationAcquisition"
  ADD CONSTRAINT "OrganizationAcquisition_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationAcquisition"
  ADD CONSTRAINT "OrganizationAcquisition_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationAcquisition"
  ADD CONSTRAINT "OrganizationAcquisition_agentUserId_fkey"
  FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_claimedByUserId_fkey"
  FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationClaimRequest"
  ADD CONSTRAINT "OrganizationClaimRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationClaimRequest"
  ADD CONSTRAINT "OrganizationClaimRequest_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationClaimRequest"
  ADD CONSTRAINT "OrganizationClaimRequest_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
