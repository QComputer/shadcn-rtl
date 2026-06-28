-- CSV/Excel product importer draft metadata.

ALTER TABLE "ImportedProductDraft"
  ADD COLUMN "stock" INTEGER,
  ADD COLUMN "errors" JSONB,
  ADD COLUMN "rowNumber" INTEGER;

CREATE INDEX "ImportedProductDraft_rowNumber_idx" ON "ImportedProductDraft"("rowNumber");
