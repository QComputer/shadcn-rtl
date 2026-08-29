-- BB-P1: keep Bazarbaaz payment-domain money in Toman. Rial exists only at
-- the iNoti provider boundary (UssdPaymentIntent remains provider-denominated).

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'INOTI_USSD';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PaymentRequest" WHERE "amountRial" % 10 <> 0
  ) OR EXISTS (
    SELECT 1 FROM "PaymentProviderAttempt" WHERE "amountRial" % 10 <> 0
  ) THEN
    RAISE EXCEPTION 'Cannot convert non-Toman-aligned payment amounts from Rial';
  END IF;
END $$;

ALTER TABLE "PaymentRequest" RENAME COLUMN "amountRial" TO "amountToman";
ALTER TABLE "PaymentProviderAttempt" RENAME COLUMN "amountRial" TO "amountToman";

UPDATE "PaymentRequest"
SET "amountToman" = "amountToman" / 10,
    "currency" = 'TOMAN';

UPDATE "PaymentProviderAttempt"
SET "amountToman" = "amountToman" / 10;

ALTER TABLE "PaymentRequest"
  ALTER COLUMN "currency" SET DEFAULT 'TOMAN',
  ADD CONSTRAINT "PaymentRequest_amountToman_positive" CHECK ("amountToman" > 0),
  ADD CONSTRAINT "PaymentRequest_currency_toman" CHECK ("currency" = 'TOMAN');

ALTER TABLE "PaymentProviderAttempt"
  ADD CONSTRAINT "PaymentProviderAttempt_amountToman_positive" CHECK ("amountToman" > 0);
