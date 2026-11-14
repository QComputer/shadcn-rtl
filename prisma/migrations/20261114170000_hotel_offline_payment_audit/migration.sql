ALTER TYPE "HotelOfflinePaymentCommandType" ADD VALUE 'REJECT_BANK_TRANSFER';
ALTER TYPE "HotelOfflinePaymentCommandType" ADD VALUE 'REVERSE_CASH';

CREATE TYPE "HotelOfflinePaymentAuditEventType" AS ENUM (
  'CASH_RECORDED', 'BANK_TRANSFER_SUBMITTED', 'BANK_TRANSFER_VERIFIED', 'BANK_TRANSFER_REJECTED', 'CASH_REVERSED'
);

CREATE TABLE "HotelOfflinePaymentAuditEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ledgerEntryId" TEXT NOT NULL,
  "eventType" "HotelOfflinePaymentAuditEventType" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "amountToman" BIGINT NOT NULL,
  "reason" VARCHAR(500),
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelOfflinePaymentAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelOfflinePaymentAuditEvent_amount_check" CHECK ("amountToman" > 0),
  CONSTRAINT "HotelOfflinePaymentAuditEvent_reason_check" CHECK (
    "eventType" NOT IN ('BANK_TRANSFER_REJECTED', 'CASH_REVERSED') OR length(btrim(coalesce("reason", ''))) > 0
  ),
  CONSTRAINT "HotelOfflinePaymentAuditEvent_ledger_tenant_fkey" FOREIGN KEY ("ledgerEntryId", "organizationId")
    REFERENCES "HotelOfflinePayment"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelOfflinePaymentAuditEvent_org_event_key_key"
  ON "HotelOfflinePaymentAuditEvent"("organizationId", "eventType", "idempotencyKey");
CREATE INDEX "HotelOfflinePaymentAuditEvent_org_ledger_created_idx"
  ON "HotelOfflinePaymentAuditEvent"("organizationId", "ledgerEntryId", "createdAt");
