-- Additive customer identity and interaction foundation.
CREATE TYPE "CustomerIdentityStatus" AS ENUM ('ACTIVE', 'MERGED', 'ARCHIVED');
CREATE TYPE "CustomerInteractionType" AS ENUM (
  'CUSTOMER_CREATED',
  'ORDER_CREATED',
  'APPOINTMENT_CREATED',
  'USSD_SESSION_STARTED',
  'PAYMENT_COMPLETED',
  'CAMPAIGN_CLICKED',
  'INTEGRATION_EVENT'
);

CREATE TABLE "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "guestCustomerId" TEXT,
    "phone" TEXT,
    "phoneHash" TEXT,
    "email" TEXT,
    "externalIdentifiers" JSONB,
    "metadata" JSONB,
    "status" "CustomerIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerInteraction" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerIdentityId" TEXT NOT NULL,
    "integrationId" TEXT,
    "businessEventId" TEXT,
    "type" "CustomerInteractionType" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerInteraction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BusinessEvent"
  ADD COLUMN "customerIdentityId" TEXT;

ALTER TABLE "UssdSession"
  ADD COLUMN "customerIdentityId" TEXT;

CREATE UNIQUE INDEX "CustomerIdentity_publicId_key" ON "CustomerIdentity"("publicId");
CREATE UNIQUE INDEX "CustomerIdentity_id_organizationId_key" ON "CustomerIdentity"("id", "organizationId");
CREATE UNIQUE INDEX "CustomerIdentity_organizationId_phoneHash_key" ON "CustomerIdentity"("organizationId", "phoneHash");
CREATE UNIQUE INDEX "CustomerIdentity_organizationId_email_key" ON "CustomerIdentity"("organizationId", "email");
CREATE INDEX "CustomerIdentity_organizationId_status_idx" ON "CustomerIdentity"("organizationId", "status");
CREATE INDEX "CustomerIdentity_organizationId_updatedAt_idx" ON "CustomerIdentity"("organizationId", "updatedAt");
CREATE INDEX "CustomerIdentity_userId_idx" ON "CustomerIdentity"("userId");
CREATE INDEX "CustomerIdentity_guestCustomerId_idx" ON "CustomerIdentity"("guestCustomerId");

CREATE UNIQUE INDEX "CustomerInteraction_publicId_key" ON "CustomerInteraction"("publicId");
CREATE INDEX "CustomerInteraction_organizationId_customerIdentityId_occurredAt_idx" ON "CustomerInteraction"("organizationId", "customerIdentityId", "occurredAt");
CREATE INDEX "CustomerInteraction_organizationId_type_occurredAt_idx" ON "CustomerInteraction"("organizationId", "type", "occurredAt");
CREATE INDEX "CustomerInteraction_integrationId_occurredAt_idx" ON "CustomerInteraction"("integrationId", "occurredAt");
CREATE INDEX "CustomerInteraction_businessEventId_idx" ON "CustomerInteraction"("businessEventId");

CREATE INDEX "BusinessEvent_customerIdentityId_occurredAt_idx" ON "BusinessEvent"("customerIdentityId", "occurredAt");
CREATE INDEX "UssdSession_customerIdentityId_lastSeenAt_idx" ON "UssdSession"("customerIdentityId", "lastSeenAt");

ALTER TABLE "CustomerIdentity"
  ADD CONSTRAINT "CustomerIdentity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerIdentity_guestCustomerId_fkey"
  FOREIGN KEY ("guestCustomerId") REFERENCES "GuestCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerInteraction"
  ADD CONSTRAINT "CustomerInteraction_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerInteraction_customerIdentityId_organizationId_fkey"
  FOREIGN KEY ("customerIdentityId", "organizationId") REFERENCES "CustomerIdentity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerInteraction_integrationId_organizationId_fkey"
  FOREIGN KEY ("integrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerInteraction_businessEventId_fkey"
  FOREIGN KEY ("businessEventId") REFERENCES "BusinessEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BusinessEvent"
  ADD CONSTRAINT "BusinessEvent_customerIdentityId_organizationId_fkey"
  FOREIGN KEY ("customerIdentityId", "organizationId") REFERENCES "CustomerIdentity"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "UssdSession"
  ADD CONSTRAINT "UssdSession_customerIdentityId_organizationId_fkey"
  FOREIGN KEY ("customerIdentityId", "organizationId") REFERENCES "CustomerIdentity"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
