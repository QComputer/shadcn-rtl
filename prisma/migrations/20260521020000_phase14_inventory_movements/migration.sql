-- Phase 14: Inventory movement history and operational integrity.
DO $$ BEGIN
  CREATE TYPE "InventoryMovementReason" AS ENUM ('INITIAL_STOCK', 'MANUAL_ADJUSTMENT', 'ORDER_CREATED', 'ORDER_CANCELLED', 'ORDER_REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryMovement" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "orderId" TEXT,
  "quantityDelta" INTEGER NOT NULL,
  "quantityBefore" INTEGER,
  "quantityAfter" INTEGER,
  "reason" "InventoryMovementReason" NOT NULL,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryMovement_variantId_idx" ON "InventoryMovement"("variantId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_reason_idx" ON "InventoryMovement"("reason");
CREATE INDEX IF NOT EXISTS "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");
CREATE INDEX IF NOT EXISTS "InventoryMovement_createdById_idx" ON "InventoryMovement"("createdById");

DO $$ BEGIN
  ALTER TABLE "InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
