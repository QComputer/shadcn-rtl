CREATE TYPE "InotiPaymentMerchantAccountKey" AS ENUM ('PLATFORM_OWNER', 'CAFE_LEO');

CREATE TABLE "OrganizationInotiPaymentRouting" (
  "organizationId" TEXT NOT NULL,
  "merchantAccountKey" "InotiPaymentMerchantAccountKey" NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationInotiPaymentRouting_pkey" PRIMARY KEY ("organizationId"),
  CONSTRAINT "OrganizationInotiPaymentRouting_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationInotiPaymentRouting_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "OrganizationInotiPaymentRouting_merchantAccountKey_idx"
  ON "OrganizationInotiPaymentRouting"("merchantAccountKey");

-- A dedicated account may be assigned to one persisted organization policy.
-- Production assignment is a separate, audited provisioning gate once the
-- Cafe Leo organization ID and account mapping have been verified.
CREATE UNIQUE INDEX "OrganizationInotiPaymentRouting_cafe_leo_account_key"
  ON "OrganizationInotiPaymentRouting"("merchantAccountKey")
  WHERE "merchantAccountKey" = 'CAFE_LEO';

-- Materialize an explicit shared-account default for every existing tenant.
-- Runtime resolution fails closed if a policy row is absent. This migration
-- does not infer or provision a dedicated tenant account from a mutable slug.
INSERT INTO "OrganizationInotiPaymentRouting" (
  "organizationId", "merchantAccountKey", "createdAt", "updatedAt"
)
SELECT "id", 'PLATFORM_OWNER'::"InotiPaymentMerchantAccountKey",
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization"
ON CONFLICT ("organizationId") DO NOTHING;

CREATE FUNCTION "defaultInotiPaymentRoutingForNewOrganization"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "OrganizationInotiPaymentRouting" (
    "organizationId", "merchantAccountKey", "createdAt", "updatedAt"
  ) VALUES (NEW."id", 'PLATFORM_OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("organizationId") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Organization_default_inoti_payment_routing"
AFTER INSERT ON "Organization"
FOR EACH ROW EXECUTE FUNCTION "defaultInotiPaymentRoutingForNewOrganization"();

ALTER TABLE "PaymentRequest"
  ADD COLUMN "merchantAccountKey" TEXT,
  ADD COLUMN "credentialProfileKeySnapshot" TEXT,
  ADD COLUMN "merchantCodeName" TEXT,
  ADD COLUMN "accountBoundAt" TIMESTAMP(3);

ALTER TABLE "PaymentProviderAttempt"
  ADD COLUMN "merchantAccountKey" TEXT,
  ADD COLUMN "credentialProfileKeySnapshot" TEXT,
  ADD COLUMN "merchantCodeName" TEXT;

ALTER TABLE "UssdPaymentIntent"
  ADD COLUMN "merchantAccountKey" TEXT,
  ADD COLUMN "credentialProfileKeySnapshot" TEXT,
  ADD COLUMN "merchantCodeName" TEXT;

-- Preserve every existing pending intent's original integration identity and
-- credential selection instead of reinterpreting it under the new policy.
UPDATE "UssdPaymentIntent" i
SET "merchantAccountKey" = 'LEGACY_INTEGRATION:' || i."integrationId",
    "credentialProfileKeySnapshot" = oi."credentialProfileKey",
    "merchantCodeName" = oi."codeName"
FROM "OrganizationIntegration" oi
WHERE oi."id" = i."integrationId";

UPDATE "PaymentProviderAttempt" a
SET "merchantAccountKey" = i."merchantAccountKey",
    "credentialProfileKeySnapshot" = i."credentialProfileKeySnapshot",
    "merchantCodeName" = i."merchantCodeName"
FROM "UssdPaymentIntent" i
WHERE i."providerAttemptId" = a."id";

UPDATE "PaymentRequest" p
SET "merchantAccountKey" = i."merchantAccountKey",
    "credentialProfileKeySnapshot" = i."credentialProfileKeySnapshot",
    "merchantCodeName" = i."merchantCodeName",
    "accountBoundAt" = p."createdAt"
FROM "UssdPaymentIntent" i
WHERE i."paymentRequestId" = p."id";

ALTER TABLE "UssdPaymentIntent"
  ALTER COLUMN "merchantAccountKey" SET NOT NULL,
  ALTER COLUMN "merchantCodeName" SET NOT NULL,
  DROP CONSTRAINT "UssdPaymentIntent_merchantFactorId_format",
  ADD CONSTRAINT "UssdPaymentIntent_merchantFactorId_format"
    CHECK ("merchantFactorId" ~ '^[0-9]{9}$' OR "merchantFactorId" ~ '^BZ[0-9a-f]{32}$');

ALTER TABLE "PaymentProviderAttempt"
  ADD CONSTRAINT "PaymentProviderAttempt_inoti_factor_format"
  CHECK (
    "provider" <> 'INOTI_USSD' OR "merchantFactorId" IS NULL OR
    "merchantFactorId" ~ '^[0-9]{9}$' OR "merchantFactorId" ~ '^BZ[0-9a-f]{32}$'
  );

DROP INDEX "UssdPaymentIntent_merchantFactorId_key";
CREATE UNIQUE INDEX "UssdPaymentIntent_merchantAccountKey_merchantFactorId_key"
  ON "UssdPaymentIntent"("merchantAccountKey", "merchantFactorId");
CREATE UNIQUE INDEX "PaymentProviderAttempt_merchantAccountKey_merchantFactorId_key"
  ON "PaymentProviderAttempt"("merchantAccountKey", "merchantFactorId");

CREATE FUNCTION "preventInotiPaymentAccountBindingMutation"() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'PaymentRequest' THEN
    IF OLD."merchantAccountKey" IS NOT NULL AND (
      NEW."merchantAccountKey" IS DISTINCT FROM OLD."merchantAccountKey" OR
      NEW."credentialProfileKeySnapshot" IS DISTINCT FROM OLD."credentialProfileKeySnapshot" OR
      NEW."merchantCodeName" IS DISTINCT FROM OLD."merchantCodeName" OR
      NEW."accountBoundAt" IS DISTINCT FROM OLD."accountBoundAt"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'PaymentRequest_inoti_account_binding_immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'PaymentProviderAttempt' THEN
    IF OLD."merchantAccountKey" IS NOT NULL AND (
      NEW."merchantAccountKey" IS DISTINCT FROM OLD."merchantAccountKey" OR
      NEW."credentialProfileKeySnapshot" IS DISTINCT FROM OLD."credentialProfileKeySnapshot" OR
      NEW."merchantCodeName" IS DISTINCT FROM OLD."merchantCodeName" OR
      NEW."merchantFactorId" IS DISTINCT FROM OLD."merchantFactorId"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'PaymentProviderAttempt_inoti_account_binding_immutable';
    END IF;
  ELSE
    IF NEW."merchantAccountKey" IS DISTINCT FROM OLD."merchantAccountKey" OR
       NEW."credentialProfileKeySnapshot" IS DISTINCT FROM OLD."credentialProfileKeySnapshot" OR
       NEW."merchantCodeName" IS DISTINCT FROM OLD."merchantCodeName" OR
       NEW."merchantFactorId" IS DISTINCT FROM OLD."merchantFactorId" THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'UssdPaymentIntent_inoti_account_binding_immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentRequest_inoti_account_binding_immutable"
BEFORE UPDATE ON "PaymentRequest"
FOR EACH ROW EXECUTE FUNCTION "preventInotiPaymentAccountBindingMutation"();
CREATE TRIGGER "PaymentProviderAttempt_inoti_account_binding_immutable"
BEFORE UPDATE ON "PaymentProviderAttempt"
FOR EACH ROW EXECUTE FUNCTION "preventInotiPaymentAccountBindingMutation"();
CREATE TRIGGER "UssdPaymentIntent_inoti_account_binding_immutable"
BEFORE UPDATE ON "UssdPaymentIntent"
FOR EACH ROW EXECUTE FUNCTION "preventInotiPaymentAccountBindingMutation"();
