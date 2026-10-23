CREATE TABLE "ProductFavorite" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFavorite_organizationId_userId_productId_key" UNIQUE ("organizationId", "userId", "productId")
);

CREATE INDEX "ProductFavorite_userId_organizationId_idx"
    ON "ProductFavorite"("userId", "organizationId");
CREATE INDEX "ProductFavorite_organizationId_idx"
    ON "ProductFavorite"("organizationId");

ALTER TABLE "ProductFavorite"
    ADD CONSTRAINT "ProductFavorite_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFavorite"
    ADD CONSTRAINT "ProductFavorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFavorite"
    ADD CONSTRAINT "ProductFavorite_productId_organizationId_fkey"
    FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
