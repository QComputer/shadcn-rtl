-- Additive, secretless foundation for organization-scoped external integrations.
CREATE TYPE "IntegrationProvider" AS ENUM ('INOTI_USSD');
CREATE TYPE "OrganizationIntegrationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'REVOKED');
CREATE TYPE "UssdPaymentIntentStatus" AS ENUM ('REQUESTED', 'VERIFYING', 'VERIFIED', 'SETTLED', 'REJECTED');
CREATE TYPE "UssdCallbackOutcome" AS ENUM ('ACCEPTED', 'REJECTED', 'DUPLICATE', 'FAILED');

CREATE TABLE "OrganizationIntegration" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "OrganizationIntegrationStatus" NOT NULL DEFAULT 'DRAFT',
    "codeName" TEXT NOT NULL,
    "credentialProfileKey" TEXT,
    "configuration" JSONB,
    "lastCallbackAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationIntegration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrganizationIntegration_codeName_format" CHECK ("codeName" ~ '^[A-Za-z0-9_-]{1,32}$'),
    CONSTRAINT "OrganizationIntegration_credentialProfileKey_safe" CHECK ("credentialProfileKey" IS NULL OR "credentialProfileKey" = 'INOTI_DEFAULT')
);

CREATE TABLE "UssdPaymentIntent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantFactorId" TEXT NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "sessionIdHash" TEXT NOT NULL,
    "mobileHash" TEXT NOT NULL,
    "mobileMasked" TEXT NOT NULL,
    "status" "UssdPaymentIntentStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerFactorId" TEXT,
    "rrn" TEXT,
    "providerResult" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "notificationAttemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UssdPaymentIntent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UssdPaymentIntent_amountRial_positive" CHECK ("amountRial" > 0),
    CONSTRAINT "UssdPaymentIntent_merchantFactorId_format" CHECK ("merchantFactorId" ~ '^BZ[0-9a-f]{32}$'),
    CONSTRAINT "UssdPaymentIntent_hash_lengths" CHECK (length("sessionIdHash") = 64 AND length("mobileHash") = 64)
);

CREATE TABLE "UssdCallbackEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "sessionIdHash" TEXT NOT NULL,
    "mobileHash" TEXT NOT NULL,
    "callHash" TEXT NOT NULL,
    "rrnHash" TEXT,
    "outcome" "UssdCallbackOutcome" NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UssdCallbackEvent_pkey" PRIMARY KEY ("id")
);

-- Order stores the tenant through organizationSlug. Enforce the equivalent organizationId
-- boundary for every USSD payment intent without rewriting or indexing the legacy Order table.
CREATE FUNCTION "enforceUssdPaymentIntentOrderTenant"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Order" AS orders
    INNER JOIN "Organization" AS organizations
      ON organizations."slug" = orders."organizationSlug"
    WHERE orders."id" = NEW."orderId"
      AND organizations."id" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT = 'UssdPaymentIntent_order_tenant_fkey',
      MESSAGE = 'USSD payment intent order tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "UssdPaymentIntent_order_tenant_trigger"
BEFORE INSERT OR UPDATE OF "orderId", "organizationId" ON "UssdPaymentIntent"
FOR EACH ROW EXECUTE FUNCTION "enforceUssdPaymentIntentOrderTenant"();

CREATE UNIQUE INDEX "OrganizationIntegration_publicId_key" ON "OrganizationIntegration"("publicId");
CREATE UNIQUE INDEX "OrganizationIntegration_organizationId_provider_key" ON "OrganizationIntegration"("organizationId", "provider");
CREATE UNIQUE INDEX "OrganizationIntegration_id_organizationId_key" ON "OrganizationIntegration"("id", "organizationId");
CREATE INDEX "OrganizationIntegration_provider_status_idx" ON "OrganizationIntegration"("provider", "status");
CREATE INDEX "OrganizationIntegration_organizationId_status_idx" ON "OrganizationIntegration"("organizationId", "status");

CREATE UNIQUE INDEX "UssdPaymentIntent_merchantFactorId_key" ON "UssdPaymentIntent"("merchantFactorId");
CREATE UNIQUE INDEX "UssdPaymentIntent_integrationId_orderId_sessionIdHash_key" ON "UssdPaymentIntent"("integrationId", "orderId", "sessionIdHash");
CREATE UNIQUE INDEX "UssdPaymentIntent_id_integrationId_organizationId_key" ON "UssdPaymentIntent"("id", "integrationId", "organizationId");
CREATE UNIQUE INDEX "UssdPaymentIntent_integrationId_providerFactorId_key" ON "UssdPaymentIntent"("integrationId", "providerFactorId");
CREATE UNIQUE INDEX "UssdPaymentIntent_integrationId_rrn_key" ON "UssdPaymentIntent"("integrationId", "rrn");
CREATE INDEX "UssdPaymentIntent_organizationId_status_createdAt_idx" ON "UssdPaymentIntent"("organizationId", "status", "createdAt");
CREATE INDEX "UssdPaymentIntent_integrationId_status_createdAt_idx" ON "UssdPaymentIntent"("integrationId", "status", "createdAt");
CREATE INDEX "UssdPaymentIntent_orderId_status_idx" ON "UssdPaymentIntent"("orderId", "status");

CREATE UNIQUE INDEX "UssdCallbackEvent_idempotencyKey_key" ON "UssdCallbackEvent"("idempotencyKey");
CREATE INDEX "UssdCallbackEvent_organizationId_createdAt_idx" ON "UssdCallbackEvent"("organizationId", "createdAt");
CREATE INDEX "UssdCallbackEvent_integrationId_createdAt_idx" ON "UssdCallbackEvent"("integrationId", "createdAt");
CREATE INDEX "UssdCallbackEvent_paymentIntentId_createdAt_idx" ON "UssdCallbackEvent"("paymentIntentId", "createdAt");
CREATE INDEX "UssdCallbackEvent_outcome_createdAt_idx" ON "UssdCallbackEvent"("outcome", "createdAt");

ALTER TABLE "OrganizationIntegration"
  ADD CONSTRAINT "OrganizationIntegration_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UssdPaymentIntent"
  ADD CONSTRAINT "UssdPaymentIntent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UssdPaymentIntent_integrationId_organizationId_fkey"
  FOREIGN KEY ("integrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UssdPaymentIntent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UssdCallbackEvent"
  ADD CONSTRAINT "UssdCallbackEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UssdCallbackEvent_integrationId_organizationId_fkey"
  FOREIGN KEY ("integrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UssdCallbackEvent_paymentIntentId_integrationId_organizati_fkey"
  FOREIGN KEY ("paymentIntentId", "integrationId", "organizationId") REFERENCES "UssdPaymentIntent"("id", "integrationId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
