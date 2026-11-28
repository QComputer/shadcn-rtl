CREATE TABLE "HotelDamoonDataImport" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "propertyId" TEXT NOT NULL,
  "sourceDigest" VARCHAR(64) NOT NULL, "units" JSONB NOT NULL, "tariffs" JSONB NOT NULL, "mapping" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelDamoonDataImport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelDamoonDataImport_property_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelDamoonDataImport_digest_check" CHECK ("sourceDigest" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "HotelDamoonDataImport_scope_digest_key" ON "HotelDamoonDataImport"("organizationId", "propertyId", "sourceDigest");
CREATE INDEX "HotelDamoonDataImport_scope_created_idx" ON "HotelDamoonDataImport"("organizationId", "propertyId", "createdAt");
