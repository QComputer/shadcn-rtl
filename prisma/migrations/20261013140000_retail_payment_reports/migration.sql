CREATE TYPE "RetailPaymentReportKind" AS ENUM ('BANK_RECEIPT', 'BANK_TIME', 'CASH_COLLECTION');
CREATE TYPE "RetailPaymentReportStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED');

CREATE TABLE "RetailPaymentReport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "kind" "RetailPaymentReportKind" NOT NULL,
  "status" "RetailPaymentReportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "receiptKey" TEXT,
  "reportedAt" TIMESTAMP(3),
  "submittedContext" JSONB,
  "cashMode" TEXT,
  "collectorId" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetailPaymentReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RetailPaymentReport_organizationId_orderId_createdAt_idx" ON "RetailPaymentReport"("organizationId", "orderId", "createdAt");
CREATE INDEX "RetailPaymentReport_organizationId_status_createdAt_idx" ON "RetailPaymentReport"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "RetailPaymentReport_one_pending_per_order_idx" ON "RetailPaymentReport"("orderId") WHERE "status" = 'PENDING_REVIEW';
ALTER TABLE "RetailPaymentReport" ADD CONSTRAINT "RetailPaymentReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetailPaymentReport" ADD CONSTRAINT "RetailPaymentReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
