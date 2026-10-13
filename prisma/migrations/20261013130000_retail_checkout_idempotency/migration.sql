-- Nullable for all existing restaurant and hotel orders.
ALTER TABLE "Order" ADD COLUMN "retailCheckoutKey" TEXT;
CREATE UNIQUE INDEX "Order_retailCheckoutKey_key" ON "Order"("retailCheckoutKey");
