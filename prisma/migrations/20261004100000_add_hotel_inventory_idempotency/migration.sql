-- H3-D2-C additive durable idempotency record.
-- This artifact is prepared for review and must not be applied without
-- explicit disposable-database authorization.
CREATE TABLE "HotelInventoryIdempotency" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "operationScope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "HotelInventoryIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelInventoryIdempotency_organizationId_operationScope_idempotencyKey_key"
ON "HotelInventoryIdempotency"("organizationId", "operationScope", "idempotencyKey");

CREATE INDEX "HotelInventoryIdempotency_organizationId_operationScope_createdAt_idx"
ON "HotelInventoryIdempotency"("organizationId", "operationScope", "createdAt");
