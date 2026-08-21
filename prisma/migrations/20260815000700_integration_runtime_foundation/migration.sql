-- Additive runtime foundation for organization integrations.
CREATE TYPE "IntegrationHealthStatus" AS ENUM ('UNKNOWN', 'CONNECTED', 'DISCONNECTED', 'DEGRADED', 'BLOCKED');
CREATE TYPE "BusinessEventType" AS ENUM (
  'ORDER_CREATED',
  'CUSTOMER_CREATED',
  'PAYMENT_COMPLETED',
  'USSD_SESSION_STARTED',
  'INTEGRATION_CONNECTED',
  'INTEGRATION_HEALTH_CHECKED'
);
CREATE TYPE "UssdSessionStatus" AS ENUM ('STARTED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'FAILED');

ALTER TABLE "OrganizationIntegration"
  ADD COLUMN "healthStatus" "IntegrationHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "lastHealthCheckedAt" TIMESTAMP(3),
  ADD COLUMN "lastHealthErrorCode" TEXT,
  ADD COLUMN "lastHealthErrorMessage" TEXT,
  ADD COLUMN "healthMetadata" JSONB;

CREATE TABLE "BusinessEvent" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT,
    "type" "BusinessEventType" NOT NULL,
    "dedupeKey" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UssdSession" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "sessionIdHash" TEXT NOT NULL,
    "customerId" TEXT,
    "guestCustomerId" TEXT,
    "status" "UssdSessionStatus" NOT NULL DEFAULT 'STARTED',
    "state" JSONB,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UssdSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UssdSession_sessionIdHash_length" CHECK (length("sessionIdHash") = 64)
);

CREATE UNIQUE INDEX "BusinessEvent_publicId_key" ON "BusinessEvent"("publicId");
CREATE UNIQUE INDEX "BusinessEvent_organizationId_dedupeKey_key" ON "BusinessEvent"("organizationId", "dedupeKey");
CREATE INDEX "BusinessEvent_organizationId_type_occurredAt_idx" ON "BusinessEvent"("organizationId", "type", "occurredAt");
CREATE INDEX "BusinessEvent_integrationId_occurredAt_idx" ON "BusinessEvent"("integrationId", "occurredAt");
CREATE INDEX "BusinessEvent_entityType_entityId_idx" ON "BusinessEvent"("entityType", "entityId");

CREATE UNIQUE INDEX "UssdSession_publicId_key" ON "UssdSession"("publicId");
CREATE UNIQUE INDEX "UssdSession_integrationId_sessionIdHash_key" ON "UssdSession"("integrationId", "sessionIdHash");
CREATE INDEX "UssdSession_organizationId_status_lastSeenAt_idx" ON "UssdSession"("organizationId", "status", "lastSeenAt");
CREATE INDEX "UssdSession_integrationId_status_lastSeenAt_idx" ON "UssdSession"("integrationId", "status", "lastSeenAt");
CREATE INDEX "UssdSession_customerId_lastSeenAt_idx" ON "UssdSession"("customerId", "lastSeenAt");
CREATE INDEX "UssdSession_guestCustomerId_lastSeenAt_idx" ON "UssdSession"("guestCustomerId", "lastSeenAt");

ALTER TABLE "BusinessEvent"
  ADD CONSTRAINT "BusinessEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BusinessEvent_integrationId_organizationId_fkey"
  FOREIGN KEY ("integrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UssdSession"
  ADD CONSTRAINT "UssdSession_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UssdSession_integrationId_organizationId_fkey"
  FOREIGN KEY ("integrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UssdSession_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "UssdSession_guestCustomerId_fkey"
  FOREIGN KEY ("guestCustomerId") REFERENCES "GuestCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
