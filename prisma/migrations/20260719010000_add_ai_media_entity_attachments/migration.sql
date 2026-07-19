-- Attach already imported AI media assets to product/service primary media.
-- Existing manual URL image fields are preserved for backward compatibility.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "aiPrimaryMediaAssetId" TEXT;

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "aiPrimaryMediaAssetId" TEXT;

CREATE INDEX IF NOT EXISTS "Product_aiPrimaryMediaAssetId_idx"
  ON "Product"("aiPrimaryMediaAssetId");

CREATE INDEX IF NOT EXISTS "Service_aiPrimaryMediaAssetId_idx"
  ON "Service"("aiPrimaryMediaAssetId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Product_aiPrimaryMediaAssetId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_aiPrimaryMediaAssetId_fkey"
      FOREIGN KEY ("aiPrimaryMediaAssetId")
      REFERENCES "AiMediaAsset"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Service_aiPrimaryMediaAssetId_fkey'
  ) THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_aiPrimaryMediaAssetId_fkey"
      FOREIGN KEY ("aiPrimaryMediaAssetId")
      REFERENCES "AiMediaAsset"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
