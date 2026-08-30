-- BB-P2: allow provider-neutral standalone PaymentRequests to use the same
-- tenant-scoped iNoti intent lifecycle without fabricating an Order.

DO $$
BEGIN
  IF EXISTS (
    SELECT "paymentRequestId"
    FROM "UssdPaymentIntent"
    WHERE "paymentRequestId" IS NOT NULL
    GROUP BY "paymentRequestId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate USSD intents exist for a PaymentRequest';
  END IF;
END $$;

ALTER TABLE "UssdPaymentIntent"
  ALTER COLUMN "orderId" DROP NOT NULL;

CREATE OR REPLACE FUNCTION "enforceUssdPaymentIntentOrderTenant"() RETURNS trigger AS $$
BEGIN
  IF NEW."orderId" IS NULL THEN
    RETURN NEW;
  END IF;
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

CREATE UNIQUE INDEX "UssdPaymentIntent_paymentRequestId_organizationId_key"
  ON "UssdPaymentIntent"("paymentRequestId", "organizationId");
