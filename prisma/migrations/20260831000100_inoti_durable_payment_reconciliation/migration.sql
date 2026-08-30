CREATE TYPE "UssdPaymentVerificationJobStatus" AS ENUM (
  'QUEUED',
  'CLAIMED',
  'RETRY',
  'SUCCEEDED',
  'MANUAL_REVIEW',
  'EXHAUSTED'
);

CREATE TABLE "UssdPaymentVerificationJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "paymentIntentId" TEXT NOT NULL,
  "providerAttemptId" TEXT,
  "status" "UssdPaymentVerificationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "encryptedCorrelation" JSONB,
  "correlationFingerprint" TEXT NOT NULL,
  "encryptionKeyVersion" INTEGER NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "lastFailureClass" TEXT,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "correlationRetiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UssdPaymentVerificationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UssdPaymentVerificationJob_paymentIntentId_key"
  ON "UssdPaymentVerificationJob"("paymentIntentId");
CREATE UNIQUE INDEX "UssdPaymentVerificationJob_id_organizationId_key"
  ON "UssdPaymentVerificationJob"("id", "organizationId");
CREATE UNIQUE INDEX "UssdPaymentVerificationJob_paymentIntentId_integrationId_organizationId_key"
  ON "UssdPaymentVerificationJob"("paymentIntentId", "integrationId", "organizationId");
CREATE INDEX "UssdPaymentVerificationJob_status_nextAttemptAt_idx"
  ON "UssdPaymentVerificationJob"("status", "nextAttemptAt");
CREATE INDEX "UssdPaymentVerificationJob_leaseExpiresAt_idx"
  ON "UssdPaymentVerificationJob"("leaseExpiresAt");
CREATE INDEX "UssdPaymentVerificationJob_organizationId_status_updatedAt_idx"
  ON "UssdPaymentVerificationJob"("organizationId", "status", "updatedAt");
CREATE INDEX "UssdPaymentVerificationJob_integrationId_status_nextAttemptAt_idx"
  ON "UssdPaymentVerificationJob"("integrationId", "status", "nextAttemptAt");

ALTER TABLE "UssdPaymentVerificationJob"
  ADD CONSTRAINT "UssdPaymentVerificationJob_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UssdPaymentVerificationJob"
  ADD CONSTRAINT "UssdPaymentVerificationJob_integrationId_organizationId_fkey"
  FOREIGN KEY ("integrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UssdPaymentVerificationJob"
  ADD CONSTRAINT "UssdPaymentVerificationJob_paymentIntentId_integrationId_organizationId_fkey"
  FOREIGN KEY ("paymentIntentId", "integrationId", "organizationId") REFERENCES "UssdPaymentIntent"("id", "integrationId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UssdPaymentVerificationJob"
  ADD CONSTRAINT "UssdPaymentVerificationJob_providerAttemptId_organizationId_fkey"
  FOREIGN KEY ("providerAttemptId", "organizationId") REFERENCES "PaymentProviderAttempt"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
