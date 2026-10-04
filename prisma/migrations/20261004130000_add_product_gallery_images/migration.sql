CREATE TABLE "ProductGalleryImage" (
  "id" TEXT NOT NULL,
  "imageId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "organizationId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "thumbnailUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductGalleryImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Image" ADD COLUMN "thumbnailUrl" TEXT;

CREATE UNIQUE INDEX "ProductGalleryImage_imageId_productId_variantId_key"
  ON "ProductGalleryImage"("imageId", "productId", "variantId");
CREATE INDEX "ProductGalleryImage_organizationId_productId_variantId_sortOrder_idx"
  ON "ProductGalleryImage"("organizationId", "productId", "variantId", "sortOrder");
CREATE INDEX "ProductGalleryImage_productId_isPrimary_idx"
  ON "ProductGalleryImage"("productId", "isPrimary");
CREATE INDEX "ProductGalleryImage_variantId_isPrimary_idx"
  ON "ProductGalleryImage"("variantId", "isPrimary");

ALTER TABLE "ProductGalleryImage"
  ADD CONSTRAINT "ProductGalleryImage_imageId_fkey"
  FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductGalleryImage"
  ADD CONSTRAINT "ProductGalleryImage_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductGalleryImage"
  ADD CONSTRAINT "ProductGalleryImage_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
