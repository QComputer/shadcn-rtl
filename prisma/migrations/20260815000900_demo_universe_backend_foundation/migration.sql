-- Additive backend foundation for the BazarBaaz Interactive Demo Universe.
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'ORDER_ACCEPTED';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'ORDER_PREPARING';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'ORDER_READY';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'ORDER_OUT_FOR_DELIVERY';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'ORDER_COMPLETED';
ALTER TYPE "BusinessEventType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CREATED';

ALTER TYPE "CustomerInteractionType" ADD VALUE IF NOT EXISTS 'ORDER_ACCEPTED';
ALTER TYPE "CustomerInteractionType" ADD VALUE IF NOT EXISTS 'ORDER_PREPARING';
ALTER TYPE "CustomerInteractionType" ADD VALUE IF NOT EXISTS 'ORDER_READY';
ALTER TYPE "CustomerInteractionType" ADD VALUE IF NOT EXISTS 'ORDER_OUT_FOR_DELIVERY';
ALTER TYPE "CustomerInteractionType" ADD VALUE IF NOT EXISTS 'ORDER_COMPLETED';

CREATE TABLE "DemoSessionToken" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoSessionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoSessionToken_publicId_key" ON "DemoSessionToken"("publicId");
CREATE UNIQUE INDEX "DemoSessionToken_tokenHash_key" ON "DemoSessionToken"("tokenHash");
CREATE INDEX "DemoSessionToken_organizationId_role_expiresAt_idx" ON "DemoSessionToken"("organizationId", "role", "expiresAt");
CREATE INDEX "DemoSessionToken_expiresAt_idx" ON "DemoSessionToken"("expiresAt");
CREATE INDEX "DemoSessionToken_revokedAt_idx" ON "DemoSessionToken"("revokedAt");

ALTER TABLE "DemoSessionToken"
  ADD CONSTRAINT "DemoSessionToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
