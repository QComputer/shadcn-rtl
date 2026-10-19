-- H3-D3-B1-H additive artifact. Do not execute without separate migration authorization.
ALTER TABLE "HotelBookingHold"
  ADD COLUMN "ratePlanId" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TOMAN',
  ADD COLUMN "totalAmount" BIGINT,
  ADD COLUMN "nightlyRates" JSONB,
  ADD COLUMN "cancellationPolicySnapshot" JSONB;

CREATE TABLE "HotelBookingHoldIdempotency" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "operationScope" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "holdId" TEXT,
  "resultJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "HotelBookingHoldIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelBookingHoldIdempotency_scope_key"
  ON "HotelBookingHoldIdempotency" ("organizationId", "operationScope", "idempotencyKey");
CREATE INDEX "HotelBookingHoldIdempotency_scope_created_idx"
  ON "HotelBookingHoldIdempotency" ("organizationId", "operationScope", "createdAt");
