ALTER TABLE "Product" ADD COLUMN "brand" TEXT;

CREATE TABLE "ProductVariantImage" (
    "variantId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductVariantImage_pkey" PRIMARY KEY ("variantId", "imageId")
);

CREATE UNIQUE INDEX "ProductVariantImage_variantId_sortOrder_key"
ON "ProductVariantImage"("variantId", "sortOrder");

CREATE INDEX "ProductVariantImage_imageId_idx"
ON "ProductVariantImage"("imageId");

ALTER TABLE "ProductVariantImage"
ADD CONSTRAINT "ProductVariantImage_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariantImage"
ADD CONSTRAINT "ProductVariantImage_imageId_fkey"
FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
