CREATE TYPE "HotelOperationalMode" AS ENUM ('DISABLED', 'REQUEST_ONLY', 'RESERVATION');

CREATE TYPE "HotelStayRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'DECLINED', 'CANCELLED');

ALTER TABLE "HotelProperty"
ADD COLUMN "operationalMode" "HotelOperationalMode" NOT NULL DEFAULT 'DISABLED';

CREATE TABLE "HotelStayQuote" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HotelStayQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelStayRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "message" TEXT,
  "status" "HotelStayRequestStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,

  CONSTRAINT "HotelStayRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelStayQuote_id_organizationId_key"
ON "HotelStayQuote"("id", "organizationId");

CREATE INDEX "HotelStayQuote_organizationId_propertyId_userId_idx"
ON "HotelStayQuote"("organizationId", "propertyId", "userId");

CREATE UNIQUE INDEX "HotelStayRequest_quoteId_key"
ON "HotelStayRequest"("quoteId");

CREATE UNIQUE INDEX "HotelStayRequest_quoteId_organizationId_key"
ON "HotelStayRequest"("quoteId", "organizationId");

CREATE INDEX "HotelStayRequest_organizationId_propertyId_userId_createdAt_idx"
ON "HotelStayRequest"("organizationId", "propertyId", "userId", "createdAt");

ALTER TABLE "HotelStayQuote"
ADD CONSTRAINT "HotelStayQuote_propertyId_organizationId_fkey"
FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HotelStayRequest"
ADD CONSTRAINT "HotelStayRequest_propertyId_organizationId_fkey"
FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HotelStayRequest"
ADD CONSTRAINT "HotelStayRequest_quoteId_organizationId_fkey"
FOREIGN KEY ("quoteId", "organizationId") REFERENCES "HotelStayQuote"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
