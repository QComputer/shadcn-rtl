ALTER TABLE "Product" ADD COLUMN "slug" TEXT;
ALTER TABLE "Service" ADD COLUMN "slug" TEXT;

UPDATE "Product"
SET "slug" = COALESCE(
  NULLIF(
    TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM("name")), '\s+', '-', 'g'), '[^[:alnum:]_-]+', '', 'g')),
    ''
  ),
  'product'
) || '-' || SUBSTRING("id" FROM 1 FOR 6)
WHERE "slug" IS NULL;

UPDATE "Service"
SET "slug" = COALESCE(
  NULLIF(
    TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM("name")), '\s+', '-', 'g'), '[^[:alnum:]_-]+', '', 'g')),
    ''
  ),
  'service'
) || '-' || SUBSTRING("id" FROM 1 FOR 6)
WHERE "slug" IS NULL;

CREATE INDEX "Product_organizationId_slug_idx" ON "Product"("organizationId", "slug");
CREATE INDEX "Product_organizationSlug_slug_idx" ON "Product"("organizationSlug", "slug");
CREATE INDEX "Service_organizationId_slug_idx" ON "Service"("organizationId", "slug");
