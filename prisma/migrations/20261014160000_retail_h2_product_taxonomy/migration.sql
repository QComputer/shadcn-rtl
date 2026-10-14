-- Retail H2: additive product multi-category membership and tenant-owned tags.
-- No existing Product, ProductCategory or ProductVariant data is deleted/rewritten.
-- Requires a verified schema/backup and approval before any Production migration.

-- FK targets must have a matching composite unique index for database-level tenant isolation.
CREATE UNIQUE INDEX "Product_id_organizationId_key" ON "Product"("id", "organizationId");
CREATE UNIQUE INDEX "ProductCategory_id_organizationId_key" ON "ProductCategory"("id", "organizationId");

CREATE TABLE "ProductCategoryAssignment" (
  "productId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCategoryAssignment_pkey" PRIMARY KEY ("productId", "categoryId")
);
CREATE INDEX "ProductCategoryAssignment_organizationId_categoryId_idx"
  ON "ProductCategoryAssignment"("organizationId", "categoryId");
CREATE INDEX "ProductCategoryAssignment_categoryId_idx"
  ON "ProductCategoryAssignment"("categoryId");

ALTER TABLE "ProductCategoryAssignment"
  ADD CONSTRAINT "ProductCategoryAssignment_productId_organizationId_fkey"
  FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCategoryAssignment"
  ADD CONSTRAINT "ProductCategoryAssignment_categoryId_organizationId_fkey"
  FOREIGN KEY ("categoryId", "organizationId") REFERENCES "ProductCategory"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductTag" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductTag_organizationId_normalizedName_key" ON "ProductTag"("organizationId", "normalizedName");
CREATE UNIQUE INDEX "ProductTag_id_organizationId_key" ON "ProductTag"("id", "organizationId");
CREATE INDEX "ProductTag_organizationId_idx" ON "ProductTag"("organizationId");
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductTagAssignment" (
  "productId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductTagAssignment_pkey" PRIMARY KEY ("productId", "tagId")
);
CREATE INDEX "ProductTagAssignment_organizationId_tagId_idx" ON "ProductTagAssignment"("organizationId", "tagId");
CREATE INDEX "ProductTagAssignment_tagId_idx" ON "ProductTagAssignment"("tagId");
ALTER TABLE "ProductTagAssignment" ADD CONSTRAINT "ProductTagAssignment_productId_organizationId_fkey"
  FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductTagAssignment" ADD CONSTRAINT "ProductTagAssignment_tagId_organizationId_fkey"
  FOREIGN KEY ("tagId", "organizationId") REFERENCES "ProductTag"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Do not silently skip malformed historical rows or cross-tenant category links.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Product" p
    LEFT JOIN "ProductCategory" c
      ON c."id" = p."categoryId" AND c."organizationId" = p."organizationId"
    WHERE c."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Retail H2 taxonomy migration blocked: cross-tenant or missing legacy primary product category';
  END IF;
END;
$$;

-- Backfill ALL historical products, not only current/active ones, preserving identifiers.
INSERT INTO "ProductCategoryAssignment" ("productId", "categoryId", "organizationId", "createdAt")
SELECT "id", "categoryId", "organizationId", "createdAt" FROM "Product"
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- Legacy product creation/edit flows must keep the primary category in assignments.
CREATE FUNCTION "retail_h2_ensure_primary_category_assignment"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "ProductCategoryAssignment" ("productId", "categoryId", "organizationId")
  VALUES (NEW."id", NEW."categoryId", NEW."organizationId")
  ON CONFLICT ("productId", "categoryId") DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "retail_h2_product_primary_category_assignment"
AFTER INSERT OR UPDATE OF "categoryId", "organizationId" ON "Product"
FOR EACH ROW EXECUTE FUNCTION "retail_h2_ensure_primary_category_assignment"();
