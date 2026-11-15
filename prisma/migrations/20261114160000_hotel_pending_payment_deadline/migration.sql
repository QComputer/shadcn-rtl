ALTER TABLE "HotelProperty"
  ADD COLUMN "pendingPaymentMinutes" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "HotelProperty"
  ADD CONSTRAINT "HotelProperty_pending_payment_minutes_check"
  CHECK ("pendingPaymentMinutes" BETWEEN 5 AND 10080);
