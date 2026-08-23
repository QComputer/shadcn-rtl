-- Real iNoti runtime foundation: logical iNoti SMS capability, generic payment requests,
-- provider attempts/evidence, and optional links from existing USSD payment intents.

ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'INOTI_SMS';

ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_REQUEST_CREATED';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_CALLBACK_RECEIVED';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_VERIFICATION_STARTED';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_VERIFIED';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';

ALTER TYPE "SmsDeliveryStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "SmsDeliveryStatus" ADD VALUE IF NOT EXISTS 'SENDING';
ALTER TYPE "SmsDeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "SmsDeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "OutboundMessageCategory" AS ENUM ('TRANSACTIONAL', 'MARKETING');

CREATE TYPE "PaymentRequestStatus" AS ENUM (
  'CREATED',
  'AWAITING_CUSTOMER',
  'PENDING_VERIFICATION',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "PaymentProviderAttemptStatus" AS ENUM (
  'CREATED',
  'AWAITING_CUSTOMER',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TABLE "PaymentRequest" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerIdentityId" TEXT,
  "orderId" TEXT,
  "appointmentId" TEXT,
  "guestCustomerId" TEXT,
  "providerIntegrationId" TEXT,
  "amountRial" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "purpose" TEXT NOT NULL,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'CREATED',
  "providerReference" TEXT,
  "publicPaymentId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProviderAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "paymentRequestId" TEXT NOT NULL,
  "providerIntegrationId" TEXT,
  "provider" "IntegrationProvider" NOT NULL,
  "status" "PaymentProviderAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "amountRial" BIGINT NOT NULL,
  "providerFactorId" TEXT,
  "merchantFactorId" TEXT,
  "rrn" TEXT,
  "providerResult" TEXT,
  "callbackEvidence" JSONB,
  "verificationEvidence" JSONB,
  "failureReason" TEXT,
  "idempotencyKey" TEXT,
  "callbackReceivedAt" TIMESTAMP(3),
  "verificationStartedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentProviderAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UssdPaymentIntent"
  ADD COLUMN "paymentRequestId" TEXT,
  ADD COLUMN "providerAttemptId" TEXT;

CREATE UNIQUE INDEX "PaymentRequest_publicId_key" ON "PaymentRequest"("publicId");
CREATE UNIQUE INDEX "PaymentRequest_publicPaymentId_key" ON "PaymentRequest"("publicPaymentId");
CREATE UNIQUE INDEX "PaymentRequest_id_organizationId_key" ON "PaymentRequest"("id", "organizationId");
CREATE INDEX "PaymentRequest_organizationId_status_createdAt_idx" ON "PaymentRequest"("organizationId", "status", "createdAt");
CREATE INDEX "PaymentRequest_organizationId_orderId_idx" ON "PaymentRequest"("organizationId", "orderId");
CREATE INDEX "PaymentRequest_organizationId_appointmentId_idx" ON "PaymentRequest"("organizationId", "appointmentId");
CREATE INDEX "PaymentRequest_providerIntegrationId_status_idx" ON "PaymentRequest"("providerIntegrationId", "status");
CREATE INDEX "PaymentRequest_customerIdentityId_createdAt_idx" ON "PaymentRequest"("customerIdentityId", "createdAt");

CREATE UNIQUE INDEX "PaymentProviderAttempt_id_organizationId_key" ON "PaymentProviderAttempt"("id", "organizationId");
CREATE UNIQUE INDEX "PaymentProviderAttempt_organizationId_idempotencyKey_key" ON "PaymentProviderAttempt"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "PaymentProviderAttempt_providerIntegrationId_merchantFactorId_key" ON "PaymentProviderAttempt"("providerIntegrationId", "merchantFactorId");
CREATE UNIQUE INDEX "PaymentProviderAttempt_providerIntegrationId_providerFactorId_key" ON "PaymentProviderAttempt"("providerIntegrationId", "providerFactorId");
CREATE UNIQUE INDEX "PaymentProviderAttempt_providerIntegrationId_rrn_key" ON "PaymentProviderAttempt"("providerIntegrationId", "rrn");
CREATE INDEX "PaymentProviderAttempt_organizationId_status_createdAt_idx" ON "PaymentProviderAttempt"("organizationId", "status", "createdAt");
CREATE INDEX "PaymentProviderAttempt_paymentRequestId_status_idx" ON "PaymentProviderAttempt"("paymentRequestId", "status");
CREATE INDEX "PaymentProviderAttempt_providerIntegrationId_status_idx" ON "PaymentProviderAttempt"("providerIntegrationId", "status");

CREATE UNIQUE INDEX "UssdPaymentIntent_providerAttemptId_key" ON "UssdPaymentIntent"("providerAttemptId");
CREATE UNIQUE INDEX "UssdPaymentIntent_providerAttemptId_organizationId_key" ON "UssdPaymentIntent"("providerAttemptId", "organizationId");
CREATE INDEX "UssdPaymentIntent_paymentRequestId_status_idx" ON "UssdPaymentIntent"("paymentRequestId", "status");

ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_customerIdentityId_organizationId_fkey"
  FOREIGN KEY ("customerIdentityId", "organizationId") REFERENCES "CustomerIdentity"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_guestCustomerId_fkey"
  FOREIGN KEY ("guestCustomerId") REFERENCES "GuestCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_providerIntegrationId_organizationId_fkey"
  FOREIGN KEY ("providerIntegrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "PaymentProviderAttempt"
  ADD CONSTRAINT "PaymentProviderAttempt_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentProviderAttempt"
  ADD CONSTRAINT "PaymentProviderAttempt_paymentRequestId_organizationId_fkey"
  FOREIGN KEY ("paymentRequestId", "organizationId") REFERENCES "PaymentRequest"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentProviderAttempt"
  ADD CONSTRAINT "PaymentProviderAttempt_providerIntegrationId_organizationId_fkey"
  FOREIGN KEY ("providerIntegrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "UssdPaymentIntent"
  ADD CONSTRAINT "UssdPaymentIntent_paymentRequestId_organizationId_fkey"
  FOREIGN KEY ("paymentRequestId", "organizationId") REFERENCES "PaymentRequest"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "UssdPaymentIntent"
  ADD CONSTRAINT "UssdPaymentIntent_providerAttemptId_organizationId_fkey"
  FOREIGN KEY ("providerAttemptId", "organizationId") REFERENCES "PaymentProviderAttempt"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
