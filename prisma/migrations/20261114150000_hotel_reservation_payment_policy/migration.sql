CREATE TYPE "HotelManualConfirmationPolicy" AS ENUM ('DISABLED', 'CASH_ON_ARRIVAL', 'MINIMUM_VERIFIED_DEPOSIT');

ALTER TABLE "HotelProperty"
  ADD COLUMN "manualConfirmationPolicy" "HotelManualConfirmationPolicy" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN "allowedOfflinePaymentMethods" "HotelOfflinePaymentMethod"[] NOT NULL DEFAULT ARRAY[]::"HotelOfflinePaymentMethod"[],
  ADD COLUMN "minimumVerifiedDepositAmount" BIGINT;

ALTER TABLE "HotelProperty"
  ADD CONSTRAINT "HotelProperty_manual_confirmation_policy_check" CHECK (
    ("minimumVerifiedDepositAmount" IS NULL OR "minimumVerifiedDepositAmount" BETWEEN 1 AND 9007199254740991)
    AND (
      ("manualConfirmationPolicy" = 'DISABLED' AND "minimumVerifiedDepositAmount" IS NULL)
      OR ("manualConfirmationPolicy" = 'CASH_ON_ARRIVAL' AND "minimumVerifiedDepositAmount" IS NULL AND 'CASH'::"HotelOfflinePaymentMethod" = ANY("allowedOfflinePaymentMethods"))
      OR ("manualConfirmationPolicy" = 'MINIMUM_VERIFIED_DEPOSIT' AND "minimumVerifiedDepositAmount" IS NOT NULL AND cardinality("allowedOfflinePaymentMethods") > 0)
    )
  );

ALTER TABLE "HotelReservation"
  ADD COLUMN "paymentMethod" "HotelOfflinePaymentMethod";

ALTER TABLE "HotelOfflinePayment"
  ADD COLUMN "receiptKey" TEXT;
