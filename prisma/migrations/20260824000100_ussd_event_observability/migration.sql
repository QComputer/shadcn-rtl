CREATE TYPE "UssdEventType" AS ENUM (
  'USSD_SESSION_STARTED',
  'USSD_MENU_SHOWN',
  'USSD_ORDER_STATUS_REQUESTED',
  'USSD_PAYMENT_SELECTED',
  'USSD_PAYMENT_CREATED',
  'USSD_CALLBACK_RECEIVED',
  'USSD_PROVIDER_VERIFICATION_STARTED',
  'USSD_PROVIDER_VERIFICATION_FAILED',
  'USSD_SETTLEMENT_BLOCKED',
  'USSD_ERROR'
);

CREATE TABLE "UssdEvent" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "sessionIdHash" TEXT NOT NULL,
  "eventType" "UssdEventType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UssdEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UssdEvent_publicId_key" ON "UssdEvent"("publicId");

CREATE INDEX "UssdEvent_organizationId_createdAt_idx" ON "UssdEvent"("organizationId", "createdAt");
CREATE INDEX "UssdEvent_integrationId_createdAt_idx" ON "UssdEvent"("integrationId", "createdAt");
CREATE INDEX "UssdEvent_sessionIdHash_createdAt_idx" ON "UssdEvent"("sessionIdHash", "createdAt");
CREATE INDEX "UssdEvent_eventType_createdAt_idx" ON "UssdEvent"("eventType", "createdAt");

ALTER TABLE "UssdEvent" ADD CONSTRAINT "UssdEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UssdEvent" ADD CONSTRAINT "UssdEvent_integrationId_organizationId_fkey" FOREIGN KEY ("integrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
