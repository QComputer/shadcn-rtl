-- CreateEnum
CREATE TYPE "AiMediaPlatformRequestStatus" AS ENUM ('DRAFT', 'QUOTED', 'HOLD_PENDING', 'READY_TO_SUBMIT', 'SUBMITTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiMediaPlatformJobState" AS ENUM ('DRAFT', 'QUOTED', 'HOLD_PENDING', 'READY_TO_SUBMIT', 'SUBMITTED_TO_RENDER', 'QUEUED', 'CLAIMED', 'PROCESSING', 'RESULT_READY', 'IMPORT_PENDING', 'IMPORTED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AiMediaPlatformPrivacyLevel" AS ENUM ('PRIVATE', 'ORGANIZATION', 'SUPER_ADMIN_ONLY', 'ANONYMIZED_NETWORK');

-- CreateEnum
CREATE TYPE "AiMediaPlatformTargetType" AS ENUM ('PRODUCT_IMAGE', 'ORGANIZATION_LOGO', 'ORGANIZATION_COVER', 'GENERAL_CREATIVE');

-- CreateEnum
CREATE TYPE "AiMediaPlatformVisibilityScope" AS ENUM ('OWNER_ONLY', 'ORGANIZATION', 'SUPER_ADMIN', 'WORKER_SAFE');

-- CreateEnum
CREATE TYPE "AiMediaPlatformImportStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'VALIDATING', 'IMPORTED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "AiMediaSpendHoldState" AS ENUM ('PLANNED', 'ACTIVE', 'SETTLEMENT_ELIGIBLE', 'RELEASE_ELIGIBLE', 'RELEASED', 'SETTLED');

-- CreateEnum
CREATE TYPE "AiMediaJobEventAction" AS ENUM ('REQUEST_DRAFTED', 'QUOTE_CREATED', 'HOLD_PLANNED', 'JOB_MIRRORED', 'STATUS_SYNCED', 'IMPORT_PLANNED', 'ASSET_ACCEPTED', 'SPEND_RELEASE_PLANNED', 'CONTRIBUTION_MIRRORED');

-- CreateTable
CREATE TABLE "AiMediaRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "targetType" "AiMediaPlatformTargetType" NOT NULL,
    "targetId" TEXT,
    "status" "AiMediaPlatformRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "privacyLevel" "AiMediaPlatformPrivacyLevel" NOT NULL DEFAULT 'ORGANIZATION',
    "visibilityScope" "AiMediaPlatformVisibilityScope" NOT NULL DEFAULT 'OWNER_ONLY',
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "promptFingerprint" TEXT,
    "sourceFingerprints" JSONB,
    "requestPayload" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMediaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMediaJobMirror" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "state" "AiMediaPlatformJobState" NOT NULL DEFAULT 'DRAFT',
    "provider" TEXT NOT NULL DEFAULT 'MOCK',
    "providerJobId" TEXT,
    "providerStatus" TEXT,
    "contractFingerprint" TEXT,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "statusPayload" JSONB,
    "safeMetadata" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "resultReadyAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMediaJobMirror_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMediaJobEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT,
    "mirrorId" TEXT,
    "actorUserId" TEXT,
    "action" "AiMediaJobEventAction" NOT NULL,
    "state" "AiMediaPlatformJobState",
    "dedupeKey" TEXT NOT NULL,
    "safeMetadata" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMediaJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMediaImport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mirrorId" TEXT NOT NULL,
    "status" "AiMediaPlatformImportStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "outputIndex" INTEGER NOT NULL DEFAULT 0,
    "resultFingerprint" TEXT,
    "validationRisk" TEXT,
    "validationErrors" JSONB,
    "acceptedAssetId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "plannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMediaImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMediaAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mirrorId" TEXT NOT NULL,
    "importId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "visibilityScope" "AiMediaPlatformVisibilityScope" NOT NULL DEFAULT 'OWNER_ONLY',
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "storageProvider" TEXT,
    "storageKeyFingerprint" TEXT,
    "checksumSha256" TEXT,
    "byteSize" INTEGER,
    "safeMetadata" JSONB,
    "acceptedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMediaUsageQuote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "bazAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BAZ_INTERNAL_CREDIT',
    "policyKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "safeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMediaUsageQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMediaSpendHold" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mirrorId" TEXT,
    "quoteId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "state" "AiMediaSpendHoldState" NOT NULL DEFAULT 'PLANNED',
    "bazAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BAZ_INTERNAL_CREDIT',
    "idempotencyKey" TEXT NOT NULL,
    "ledgerMutationAllowed" BOOLEAN NOT NULL DEFAULT false,
    "settlementEligible" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "safeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMediaSpendHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerContributionMirror" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mirrorId" TEXT NOT NULL,
    "providerContributionId" TEXT NOT NULL,
    "workerOpaqueId" TEXT NOT NULL,
    "jobState" "AiMediaPlatformJobState" NOT NULL,
    "importedAssetAccepted" BOOLEAN NOT NULL DEFAULT false,
    "rewardPolicyKey" TEXT,
    "rewardEligible" BOOLEAN NOT NULL DEFAULT false,
    "walletCreditProduced" BOOLEAN NOT NULL DEFAULT false,
    "safeFacts" JSONB,
    "blockerCodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerContributionMirror_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiMediaRequest_organizationId_idempotencyKey_key" ON "AiMediaRequest"("organizationId", "idempotencyKey");
CREATE INDEX "AiMediaRequest_organizationId_status_createdAt_idx" ON "AiMediaRequest"("organizationId", "status", "createdAt");
CREATE INDEX "AiMediaRequest_organizationId_requestedByUserId_createdAt_idx" ON "AiMediaRequest"("organizationId", "requestedByUserId", "createdAt");
CREATE INDEX "AiMediaRequest_targetType_targetId_idx" ON "AiMediaRequest"("targetType", "targetId");
CREATE INDEX "AiMediaRequest_requestedByUserId_idx" ON "AiMediaRequest"("requestedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AiMediaJobMirror_organizationId_idempotencyKey_key" ON "AiMediaJobMirror"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "AiMediaJobMirror_correlationId_key" ON "AiMediaJobMirror"("correlationId");
CREATE UNIQUE INDEX "AiMediaJobMirror_provider_providerJobId_key" ON "AiMediaJobMirror"("provider", "providerJobId");
CREATE INDEX "AiMediaJobMirror_requestId_idx" ON "AiMediaJobMirror"("requestId");
CREATE INDEX "AiMediaJobMirror_organizationId_state_createdAt_idx" ON "AiMediaJobMirror"("organizationId", "state", "createdAt");
CREATE INDEX "AiMediaJobMirror_organizationId_requestedByUserId_createdAt_idx" ON "AiMediaJobMirror"("organizationId", "requestedByUserId", "createdAt");
CREATE INDEX "AiMediaJobMirror_providerJobId_idx" ON "AiMediaJobMirror"("providerJobId");
CREATE INDEX "AiMediaJobMirror_requestedByUserId_idx" ON "AiMediaJobMirror"("requestedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AiMediaJobEvent_organizationId_dedupeKey_key" ON "AiMediaJobEvent"("organizationId", "dedupeKey");
CREATE INDEX "AiMediaJobEvent_organizationId_createdAt_idx" ON "AiMediaJobEvent"("organizationId", "createdAt");
CREATE INDEX "AiMediaJobEvent_requestId_idx" ON "AiMediaJobEvent"("requestId");
CREATE INDEX "AiMediaJobEvent_mirrorId_idx" ON "AiMediaJobEvent"("mirrorId");
CREATE INDEX "AiMediaJobEvent_actorUserId_idx" ON "AiMediaJobEvent"("actorUserId");
CREATE INDEX "AiMediaJobEvent_action_idx" ON "AiMediaJobEvent"("action");

-- CreateIndex
CREATE UNIQUE INDEX "AiMediaImport_mirrorId_outputIndex_key" ON "AiMediaImport"("mirrorId", "outputIndex");
CREATE INDEX "AiMediaImport_organizationId_status_createdAt_idx" ON "AiMediaImport"("organizationId", "status", "createdAt");
CREATE INDEX "AiMediaImport_requestId_idx" ON "AiMediaImport"("requestId");
CREATE INDEX "AiMediaImport_mirrorId_idx" ON "AiMediaImport"("mirrorId");
CREATE INDEX "AiMediaImport_acceptedAssetId_idx" ON "AiMediaImport"("acceptedAssetId");

-- CreateIndex
CREATE INDEX "AiMediaAsset_organizationId_visibilityScope_createdAt_idx" ON "AiMediaAsset"("organizationId", "visibilityScope", "createdAt");
CREATE INDEX "AiMediaAsset_organizationId_requestedByUserId_createdAt_idx" ON "AiMediaAsset"("organizationId", "requestedByUserId", "createdAt");
CREATE INDEX "AiMediaAsset_requestId_idx" ON "AiMediaAsset"("requestId");
CREATE INDEX "AiMediaAsset_mirrorId_idx" ON "AiMediaAsset"("mirrorId");
CREATE INDEX "AiMediaAsset_importId_idx" ON "AiMediaAsset"("importId");
CREATE INDEX "AiMediaAsset_requestedByUserId_idx" ON "AiMediaAsset"("requestedByUserId");
CREATE INDEX "AiMediaAsset_checksumSha256_idx" ON "AiMediaAsset"("checksumSha256");

-- CreateIndex
CREATE UNIQUE INDEX "AiMediaUsageQuote_organizationId_idempotencyKey_key" ON "AiMediaUsageQuote"("organizationId", "idempotencyKey");
CREATE INDEX "AiMediaUsageQuote_organizationId_requestId_idx" ON "AiMediaUsageQuote"("organizationId", "requestId");
CREATE INDEX "AiMediaUsageQuote_organizationId_requestedByUserId_createdAt_idx" ON "AiMediaUsageQuote"("organizationId", "requestedByUserId", "createdAt");
CREATE INDEX "AiMediaUsageQuote_expiresAt_idx" ON "AiMediaUsageQuote"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiMediaSpendHold_organizationId_idempotencyKey_key" ON "AiMediaSpendHold"("organizationId", "idempotencyKey");
CREATE INDEX "AiMediaSpendHold_organizationId_state_createdAt_idx" ON "AiMediaSpendHold"("organizationId", "state", "createdAt");
CREATE INDEX "AiMediaSpendHold_requestId_idx" ON "AiMediaSpendHold"("requestId");
CREATE INDEX "AiMediaSpendHold_mirrorId_idx" ON "AiMediaSpendHold"("mirrorId");
CREATE INDEX "AiMediaSpendHold_quoteId_idx" ON "AiMediaSpendHold"("quoteId");
CREATE INDEX "AiMediaSpendHold_requestedByUserId_idx" ON "AiMediaSpendHold"("requestedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerContributionMirror_organizationId_providerContributionId_key" ON "WorkerContributionMirror"("organizationId", "providerContributionId");
CREATE INDEX "WorkerContributionMirror_organizationId_createdAt_idx" ON "WorkerContributionMirror"("organizationId", "createdAt");
CREATE INDEX "WorkerContributionMirror_mirrorId_idx" ON "WorkerContributionMirror"("mirrorId");
CREATE INDEX "WorkerContributionMirror_workerOpaqueId_idx" ON "WorkerContributionMirror"("workerOpaqueId");
CREATE INDEX "WorkerContributionMirror_rewardEligible_idx" ON "WorkerContributionMirror"("rewardEligible");

-- AddForeignKey
ALTER TABLE "AiMediaRequest" ADD CONSTRAINT "AiMediaRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaRequest" ADD CONSTRAINT "AiMediaRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaJobMirror" ADD CONSTRAINT "AiMediaJobMirror_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiMediaRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaJobMirror" ADD CONSTRAINT "AiMediaJobMirror_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaJobMirror" ADD CONSTRAINT "AiMediaJobMirror_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaJobEvent" ADD CONSTRAINT "AiMediaJobEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaJobEvent" ADD CONSTRAINT "AiMediaJobEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiMediaRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMediaJobEvent" ADD CONSTRAINT "AiMediaJobEvent_mirrorId_fkey" FOREIGN KEY ("mirrorId") REFERENCES "AiMediaJobMirror"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMediaJobEvent" ADD CONSTRAINT "AiMediaJobEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMediaImport" ADD CONSTRAINT "AiMediaImport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaImport" ADD CONSTRAINT "AiMediaImport_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiMediaRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaImport" ADD CONSTRAINT "AiMediaImport_mirrorId_fkey" FOREIGN KEY ("mirrorId") REFERENCES "AiMediaJobMirror"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaImport" ADD CONSTRAINT "AiMediaImport_acceptedAssetId_fkey" FOREIGN KEY ("acceptedAssetId") REFERENCES "AiMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMediaAsset" ADD CONSTRAINT "AiMediaAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaAsset" ADD CONSTRAINT "AiMediaAsset_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiMediaRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaAsset" ADD CONSTRAINT "AiMediaAsset_mirrorId_fkey" FOREIGN KEY ("mirrorId") REFERENCES "AiMediaJobMirror"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaAsset" ADD CONSTRAINT "AiMediaAsset_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AiMediaImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMediaAsset" ADD CONSTRAINT "AiMediaAsset_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaUsageQuote" ADD CONSTRAINT "AiMediaUsageQuote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaUsageQuote" ADD CONSTRAINT "AiMediaUsageQuote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiMediaRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaUsageQuote" ADD CONSTRAINT "AiMediaUsageQuote_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaSpendHold" ADD CONSTRAINT "AiMediaSpendHold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaSpendHold" ADD CONSTRAINT "AiMediaSpendHold_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AiMediaRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMediaSpendHold" ADD CONSTRAINT "AiMediaSpendHold_mirrorId_fkey" FOREIGN KEY ("mirrorId") REFERENCES "AiMediaJobMirror"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMediaSpendHold" ADD CONSTRAINT "AiMediaSpendHold_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "AiMediaUsageQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMediaSpendHold" ADD CONSTRAINT "AiMediaSpendHold_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerContributionMirror" ADD CONSTRAINT "WorkerContributionMirror_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerContributionMirror" ADD CONSTRAINT "WorkerContributionMirror_mirrorId_fkey" FOREIGN KEY ("mirrorId") REFERENCES "AiMediaJobMirror"("id") ON DELETE CASCADE ON UPDATE CASCADE;
