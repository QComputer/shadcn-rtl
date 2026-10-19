-- Retail-only lifecycle extension. Existing restaurant/hotel orders remain unchanged.
ALTER TABLE "Order"
  ADD COLUMN "retailPaymentDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "retailPaymentExpiredAt" TIMESTAMP(3);

CREATE INDEX "Order_retailCheckoutKey_retailPaymentDeadlineAt_paymentStatus_status_idx"
  ON "Order"("retailCheckoutKey", "retailPaymentDeadlineAt", "paymentStatus", "status");

ALTER TABLE "CouponRedemption" ADD COLUMN "releasedAt" TIMESTAMP(3);
CREATE INDEX "CouponRedemption_organizationId_customerId_couponId_releasedAt_idx"
  ON "CouponRedemption"("organizationId", "customerId", "couponId", "releasedAt");

-- A deterministic key makes each retail stock release idempotent without
-- changing the shared movement reason enum used by restaurant orders.
ALTER TABLE "InventoryMovement" ADD COLUMN "retailReleaseKey" TEXT;
CREATE UNIQUE INDEX "InventoryMovement_retailReleaseKey_key"
  ON "InventoryMovement"("retailReleaseKey");
