ALTER TABLE "ImportedProductDraft"
  ADD COLUMN "importedProductId" TEXT;

CREATE INDEX "ImportedProductDraft_importedProductId_idx" ON "ImportedProductDraft"("importedProductId");
