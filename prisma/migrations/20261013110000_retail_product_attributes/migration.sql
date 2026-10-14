CREATE TYPE "RetailAttributeScope" AS ENUM ('PRODUCT', 'VARIANT_OPTION');
CREATE TYPE "RetailAttributeValueType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'ENUM');

CREATE TABLE "RetailAttributeDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "localizedLabels" JSONB NOT NULL DEFAULT '{}',
  "scope" "RetailAttributeScope" NOT NULL,
  "valueType" "RetailAttributeValueType" NOT NULL,
  "displayUnit" TEXT,
  "localizedUnits" JSONB NOT NULL DEFAULT '{}',
  "allowedValues" JSONB,
  "isFilterable" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetailAttributeDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetailAttributeDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RetailAttributeDefinition_nonempty_key_check" CHECK (length(trim("key")) > 0)
);

CREATE TABLE "ProductAttributeValue" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "valueText" TEXT,
  "valueNumber" DECIMAL(18,4),
  "valueBoolean" BOOLEAN,
  CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductAttributeValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "RetailAttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductAttributeValue_one_typed_value_check" CHECK (num_nonnulls("valueText", "valueNumber", "valueBoolean") = 1)
);

CREATE TABLE "ProductVariantAttributeValue" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "valueText" TEXT,
  "valueNumber" DECIMAL(18,4),
  "valueBoolean" BOOLEAN,
  CONSTRAINT "ProductVariantAttributeValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariantAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductVariantAttributeValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "RetailAttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductVariantAttributeValue_one_typed_value_check" CHECK (num_nonnulls("valueText", "valueNumber", "valueBoolean") = 1)
);

CREATE UNIQUE INDEX "RetailAttributeDefinition_organizationId_key_key" ON "RetailAttributeDefinition"("organizationId", "key");
CREATE UNIQUE INDEX "RetailAttributeDefinition_id_organizationId_key" ON "RetailAttributeDefinition"("id", "organizationId");
CREATE INDEX "RetailAttributeDefinition_organizationId_scope_isActive_sortOrder_idx" ON "RetailAttributeDefinition"("organizationId", "scope", "isActive", "sortOrder");
CREATE UNIQUE INDEX "ProductAttributeValue_productId_definitionId_key" ON "ProductAttributeValue"("productId", "definitionId");
CREATE INDEX "ProductAttributeValue_definitionId_valueText_idx" ON "ProductAttributeValue"("definitionId", "valueText");
CREATE INDEX "ProductAttributeValue_definitionId_valueNumber_idx" ON "ProductAttributeValue"("definitionId", "valueNumber");
CREATE INDEX "ProductAttributeValue_definitionId_valueBoolean_idx" ON "ProductAttributeValue"("definitionId", "valueBoolean");
CREATE UNIQUE INDEX "ProductVariantAttributeValue_variantId_definitionId_key" ON "ProductVariantAttributeValue"("variantId", "definitionId");
CREATE INDEX "ProductVariantAttributeValue_definitionId_valueText_idx" ON "ProductVariantAttributeValue"("definitionId", "valueText");
CREATE INDEX "ProductVariantAttributeValue_definitionId_valueNumber_idx" ON "ProductVariantAttributeValue"("definitionId", "valueNumber");
CREATE INDEX "ProductVariantAttributeValue_definitionId_valueBoolean_idx" ON "ProductVariantAttributeValue"("definitionId", "valueBoolean");
