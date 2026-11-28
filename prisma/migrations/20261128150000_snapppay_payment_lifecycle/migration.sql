-- Tenant-scoped merchant pricing policy. It stores no provider credentials and
-- does not change any existing payment, order, or ordinary merchandise price.
CREATE TABLE "RetailInstallmentPricingPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "markupPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetailInstallmentPricingPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RetailInstallmentPricingPolicy_markupPercent_check" CHECK ("markupPercent" >= 0 AND "markupPercent" <= 1000),
    CONSTRAINT "RetailInstallmentPricingPolicy_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "RetailInstallmentPricingPolicy_organizationId_key"
    ON "RetailInstallmentPricingPolicy"("organizationId");
CREATE INDEX "RetailInstallmentPricingPolicy_organizationId_version_idx"
    ON "RetailInstallmentPricingPolicy"("organizationId", "version");

ALTER TABLE "RetailInstallmentPricingPolicy"
    ADD CONSTRAINT "RetailInstallmentPricingPolicy_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant-safe composite order identity for the immutable installment quote.
CREATE UNIQUE INDEX "Order_id_organizationSlug_key" ON "Order"("id", "organizationSlug");

CREATE TABLE "RetailInstallmentQuoteSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationSlug" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentRequestId" TEXT,
    "policyVersion" INTEGER NOT NULL,
    "appliedMarkupPercent" DECIMAL(8,4) NOT NULL,
    "originalMerchandiseAmount" DECIMAL(20,4) NOT NULL,
    "adjustedMerchandiseAmount" DECIMAL(20,4) NOT NULL,
    "deliveryAmount" DECIMAL(20,4) NOT NULL,
    "discountAmount" DECIMAL(20,4) NOT NULL,
    "finalPayableAmountToman" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TOMAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetailInstallmentQuoteSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RetailInstallmentQuoteSnapshot_policyVersion_check" CHECK ("policyVersion" >= 0),
    CONSTRAINT "RetailInstallmentQuoteSnapshot_markupPercent_check" CHECK ("appliedMarkupPercent" >= 0 AND "appliedMarkupPercent" <= 1000),
    CONSTRAINT "RetailInstallmentQuoteSnapshot_finalAmount_check" CHECK ("finalPayableAmountToman" > 0),
    CONSTRAINT "RetailInstallmentQuoteSnapshot_currency_check" CHECK ("currency" = 'TOMAN')
);

CREATE UNIQUE INDEX "RetailInstallmentQuoteSnapshot_orderId_key" ON "RetailInstallmentQuoteSnapshot"("orderId");
CREATE UNIQUE INDEX "RetailInstallmentQuoteSnapshot_paymentRequestId_key" ON "RetailInstallmentQuoteSnapshot"("paymentRequestId");
CREATE UNIQUE INDEX "RetailInstallmentQuoteSnapshot_id_organizationSlug_key" ON "RetailInstallmentQuoteSnapshot"("id", "organizationSlug");
CREATE UNIQUE INDEX "RetailInstallmentQuoteSnapshot_orderId_organizationSlug_key" ON "RetailInstallmentQuoteSnapshot"("orderId", "organizationSlug");
CREATE UNIQUE INDEX "RetailInstallmentQuoteSnapshot_paymentRequestId_organizationId_key" ON "RetailInstallmentQuoteSnapshot"("paymentRequestId", "organizationId");
CREATE INDEX "RetailInstallmentQuoteSnapshot_organizationSlug_createdAt_idx" ON "RetailInstallmentQuoteSnapshot"("organizationSlug", "createdAt");

ALTER TABLE "RetailInstallmentQuoteSnapshot"
    ADD CONSTRAINT "RetailInstallmentQuoteSnapshot_organizationId_organizationSlug_fkey"
    FOREIGN KEY ("organizationId", "organizationSlug") REFERENCES "Organization"("id", "slug")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "RetailInstallmentQuoteSnapshot_orderId_organizationSlug_fkey"
    FOREIGN KEY ("orderId", "organizationSlug") REFERENCES "Order"("id", "organizationSlug")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "RetailInstallmentQuoteSnapshot_paymentRequestId_organizationId_fkey"
    FOREIGN KEY ("paymentRequestId", "organizationId") REFERENCES "PaymentRequest"("id", "organizationId")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "RetailInstallmentQuoteSnapshotLine" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "organizationSlug" TEXT NOT NULL,
    "productIdSnapshot" TEXT NOT NULL,
    "variantIdSnapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "originalUnitAmount" DECIMAL(20,4) NOT NULL,
    "adjustedUnitAmount" DECIMAL(20,4) NOT NULL,
    "originalLineAmount" DECIMAL(20,4) NOT NULL,
    "adjustedLineAmount" DECIMAL(20,4) NOT NULL,
    CONSTRAINT "RetailInstallmentQuoteSnapshotLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RetailInstallmentQuoteSnapshotLine_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "RetailInstallmentQuoteSnapshotLine_amounts_check" CHECK (
      "originalUnitAmount" >= 0 AND "adjustedUnitAmount" >= 0 AND
      "originalLineAmount" >= 0 AND "adjustedLineAmount" >= 0
    )
);

CREATE INDEX "RetailInstallmentQuoteSnapshotLine_organizationSlug_snapshotId_idx"
    ON "RetailInstallmentQuoteSnapshotLine"("organizationSlug", "snapshotId");
ALTER TABLE "RetailInstallmentQuoteSnapshotLine"
    ADD CONSTRAINT "RetailInstallmentQuoteSnapshotLine_snapshotId_organizationSlug_fkey"
    FOREIGN KEY ("snapshotId", "organizationSlug") REFERENCES "RetailInstallmentQuoteSnapshot"("id", "organizationSlug")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Financial quote records may be removed by tenant/order retention cascades,
-- but application writes cannot revise the captured values.
CREATE FUNCTION "reject_immutable_payment_evidence_update"() RETURNS trigger AS $$
DECLARE
  request_amount BIGINT;
  request_currency TEXT;
BEGIN
  IF TG_TABLE_NAME = 'RetailInstallmentQuoteSnapshot'
     AND OLD."paymentRequestId" IS NULL
     AND NEW."paymentRequestId" IS NOT NULL
     AND (NEW."id", NEW."organizationId", NEW."organizationSlug", NEW."orderId", NEW."policyVersion",
          NEW."appliedMarkupPercent", NEW."originalMerchandiseAmount", NEW."adjustedMerchandiseAmount",
          NEW."deliveryAmount", NEW."discountAmount", NEW."finalPayableAmountToman", NEW."currency", NEW."createdAt")
       IS NOT DISTINCT FROM
         (OLD."id", OLD."organizationId", OLD."organizationSlug", OLD."orderId", OLD."policyVersion",
          OLD."appliedMarkupPercent", OLD."originalMerchandiseAmount", OLD."adjustedMerchandiseAmount",
          OLD."deliveryAmount", OLD."discountAmount", OLD."finalPayableAmountToman", OLD."currency", OLD."createdAt")
  THEN
    SELECT "amountToman", "currency" INTO request_amount, request_currency
      FROM "PaymentRequest"
      WHERE "id" = NEW."paymentRequestId" AND "organizationId" = NEW."organizationId";
    IF NOT FOUND OR request_amount <> NEW."finalPayableAmountToman" OR request_currency <> NEW."currency" THEN
      RAISE EXCEPTION 'PaymentRequest amount must match immutable installment quote snapshot';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Payment lifecycle evidence is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RetailInstallmentQuoteSnapshot_immutable_update"
    BEFORE UPDATE ON "RetailInstallmentQuoteSnapshot"
    FOR EACH ROW EXECUTE FUNCTION "reject_immutable_payment_evidence_update"();
CREATE TRIGGER "RetailInstallmentQuoteSnapshotLine_immutable_update"
    BEFORE UPDATE ON "RetailInstallmentQuoteSnapshotLine"
    FOR EACH ROW EXECUTE FUNCTION "reject_immutable_payment_evidence_update"();

-- Durable callback/provider-event deduplication stores only digests and
-- allowlisted processing fields, never raw payloads, tokens, or credentials.
CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerIntegrationId" TEXT NOT NULL,
    "paymentRequestId" TEXT,
    "providerAttemptId" TEXT,
    "deduplicationKeyHash" CHAR(64) NOT NULL,
    "payloadDigest" CHAR(64) NOT NULL,
    "eventKind" VARCHAR(48) NOT NULL,
    "sanitizedProviderCode" VARCHAR(80),
    "disposition" VARCHAR(32) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentProviderEvent_deduplicationKeyHash_check" CHECK ("deduplicationKeyHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "PaymentProviderEvent_payloadDigest_check" CHECK ("payloadDigest" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "PaymentProviderEvent_eventKind_check" CHECK ("eventKind" ~ '^[A-Z0-9_]{1,48}$'),
    CONSTRAINT "PaymentProviderEvent_disposition_check" CHECK ("disposition" ~ '^[A-Z0-9_]{1,32}$'),
    CONSTRAINT "PaymentProviderEvent_providerCode_check" CHECK ("sanitizedProviderCode" IS NULL OR "sanitizedProviderCode" ~ '^[A-Z0-9_.-]{1,80}$')
);

CREATE UNIQUE INDEX "PaymentProviderEvent_org_integration_dedupe_key"
    ON "PaymentProviderEvent"("organizationId", "providerIntegrationId", "deduplicationKeyHash");
CREATE INDEX "PaymentProviderEvent_organizationId_receivedAt_idx"
    ON "PaymentProviderEvent"("organizationId", "receivedAt");
CREATE INDEX "PaymentProviderEvent_paymentRequestId_receivedAt_idx"
    ON "PaymentProviderEvent"("paymentRequestId", "receivedAt");
CREATE INDEX "PaymentProviderEvent_providerAttemptId_receivedAt_idx"
    ON "PaymentProviderEvent"("providerAttemptId", "receivedAt");
ALTER TABLE "PaymentProviderEvent"
    ADD CONSTRAINT "PaymentProviderEvent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "PaymentProviderEvent_providerIntegrationId_organizationId_fkey"
    FOREIGN KEY ("providerIntegrationId", "organizationId") REFERENCES "OrganizationIntegration"("id", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "PaymentProviderEvent_paymentRequestId_organizationId_fkey"
    FOREIGN KEY ("paymentRequestId", "organizationId") REFERENCES "PaymentRequest"("id", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "PaymentProviderEvent_providerAttemptId_organizationId_fkey"
    FOREIGN KEY ("providerAttemptId", "organizationId") REFERENCES "PaymentProviderAttempt"("id", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER "PaymentProviderEvent_immutable_update"
    BEFORE UPDATE ON "PaymentProviderEvent"
    FOR EACH ROW EXECUTE FUNCTION "reject_immutable_payment_evidence_update"();
