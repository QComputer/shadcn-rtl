ALTER TABLE "OrderItem"
  ADD COLUMN "skuSnapshot" TEXT,
  ADD COLUMN "variantNameSnapshot" TEXT,
  ADD COLUMN "variantOptionsSnapshot" JSONB;
