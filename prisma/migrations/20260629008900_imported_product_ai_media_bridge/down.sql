DROP INDEX "ImportedProductDraft_importedProductId_idx";

ALTER TABLE "ImportedProductDraft"
  DROP COLUMN "importedProductId";
