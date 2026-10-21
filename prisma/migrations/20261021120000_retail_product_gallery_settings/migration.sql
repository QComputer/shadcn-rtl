-- Optional presentation metadata only. Existing product and variant image
-- relationships remain authoritative and are not backfilled or modified.
ALTER TABLE "Product" ADD COLUMN "gallerySettings" JSONB;
