-- Phase 5: order/payment production hardening
-- Convert Order.paymentStatus from boolean to PaymentStatus enum and add append-only history tables.

ALTER TABLE "Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus"
  USING CASE
    WHEN "paymentStatus" = true THEN 'COMPLETED'::"PaymentStatus"
    ELSE 'PENDING'::"PaymentStatus"
  END;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING'::"PaymentStatus";

CREATE TABLE "PaymentEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "previousStatus" "PaymentStatus",
  "newStatus" "PaymentStatus" NOT NULL,
  "method" "PaymentMethod",
  "amount" DECIMAL(65,30),
  "transactionId" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderStatusHistory" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "previousStatus" "OrderStatus",
  "newStatus" "OrderStatus" NOT NULL,
  "note" TEXT,
  "changedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PaymentEvent_orderId_idx" ON "PaymentEvent"("orderId");
CREATE INDEX "PaymentEvent_newStatus_idx" ON "PaymentEvent"("newStatus");
CREATE INDEX "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");
CREATE INDEX "PaymentEvent_createdById_idx" ON "PaymentEvent"("createdById");

CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");
CREATE INDEX "OrderStatusHistory_newStatus_idx" ON "OrderStatusHistory"("newStatus");
CREATE INDEX "OrderStatusHistory_createdAt_idx" ON "OrderStatusHistory"("createdAt");
CREATE INDEX "OrderStatusHistory_changedById_idx" ON "OrderStatusHistory"("changedById");
