ALTER TABLE "ServiceCategory" ADD COLUMN "slug" TEXT;
ALTER TABLE "ProductCategory" ADD COLUMN "slug" TEXT;

UPDATE "ServiceCategory"
SET "slug" = COALESCE(
  NULLIF(
    TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM("name")), '\s+', '-', 'g'), '[^[:alnum:]_-]+', '', 'g')),
    ''
  ),
  'category'
) || '-' || SUBSTRING("id" FROM 1 FOR 6)
WHERE "slug" IS NULL;

UPDATE "ProductCategory"
SET "slug" = COALESCE(
  NULLIF(
    TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM("name")), '\s+', '-', 'g'), '[^[:alnum:]_-]+', '', 'g')),
    ''
  ),
  'category'
) || '-' || SUBSTRING("id" FROM 1 FOR 6)
WHERE "slug" IS NULL;

CREATE INDEX "ServiceCategory_organizationId_slug_idx" ON "ServiceCategory"("organizationId", "slug");
CREATE INDEX "ProductCategory_organizationId_slug_idx" ON "ProductCategory"("organizationId", "slug");
