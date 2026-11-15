CREATE TYPE "HotelOfflinePaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER');
CREATE TYPE "HotelOfflinePaymentStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED', 'REVERSED');
CREATE TYPE "HotelOfflinePaymentCommandType" AS ENUM ('RECORD_CASH', 'SUBMIT_BANK_TRANSFER', 'VERIFY_BANK_TRANSFER');

CREATE TABLE "HotelOfflinePayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "method" "HotelOfflinePaymentMethod" NOT NULL,
  "status" "HotelOfflinePaymentStatus" NOT NULL,
  "amountToman" BIGINT NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "bankReference" VARCHAR(160),
  "verifiedByUserId" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelOfflinePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelOfflinePayment_amount_check" CHECK ("amountToman" > 0),
  CONSTRAINT "HotelOfflinePayment_cash_check" CHECK ("method" <> 'CASH' OR ("status" IN ('VERIFIED', 'REVERSED') AND "bankReference" IS NULL)),
  CONSTRAINT "HotelOfflinePayment_verified_check" CHECK ("status" <> 'VERIFIED' OR ("verifiedByUserId" IS NOT NULL AND "verifiedAt" IS NOT NULL)),
  CONSTRAINT "HotelOfflinePayment_submitted_check" CHECK ("status" <> 'SUBMITTED' OR ("method" = 'BANK_TRANSFER' AND "verifiedByUserId" IS NULL AND "verifiedAt" IS NULL)),
  CONSTRAINT "HotelOfflinePayment_reservation_tenant_fkey" FOREIGN KEY ("reservationId", "organizationId") REFERENCES "HotelReservation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelOfflinePayment_id_organizationId_key" ON "HotelOfflinePayment"("id", "organizationId");
CREATE INDEX "HotelOfflinePayment_organizationId_reservationId_createdAt_idx" ON "HotelOfflinePayment"("organizationId", "reservationId", "createdAt");

CREATE TABLE "HotelOfflinePaymentCommandIdempotency" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "operation" "HotelOfflinePaymentCommandType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "ledgerEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "HotelOfflinePaymentCommandIdempotency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelOfflinePaymentCommandIdempotency_ledger_tenant_fkey" FOREIGN KEY ("ledgerEntryId", "organizationId") REFERENCES "HotelOfflinePayment"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelOfflinePaymentCommandIdempotency_org_operation_key_key" ON "HotelOfflinePaymentCommandIdempotency"("organizationId", "operation", "idempotencyKey");
CREATE INDEX "HotelOfflinePaymentCommandIdempotency_org_ledger_idx" ON "HotelOfflinePaymentCommandIdempotency"("organizationId", "ledgerEntryId");
