CREATE TABLE "HotelWebsiteOperation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestSha256" CHAR(64) NOT NULL,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelWebsiteOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelWebsiteOperation_requestSha256_check" CHECK ("requestSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "HotelWebsiteOperation_key_check" CHECK (length("idempotencyKey") BETWEEN 8 AND 128),
  CONSTRAINT "HotelWebsiteOperation_operation_check" CHECK ("operation" IN ('CREATE_DRAFT', 'SUBMIT', 'APPROVE', 'REJECT', 'PUBLISH', 'REVOKE')),
  CONSTRAINT "HotelWebsiteOperation_property_scope_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelWebsiteOperation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelWebsiteOperation_scope_operation_key_key"
  ON "HotelWebsiteOperation"("organizationId", "propertyId", "operation", "idempotencyKey");
CREATE INDEX "HotelWebsiteOperation_scope_createdAt_idx"
  ON "HotelWebsiteOperation"("organizationId", "propertyId", "createdAt");
