-- Additive, no backfill, no ownership grants. Apply only to authorized fixtures here.
CREATE TABLE "HotelGuestReservationProof" (
  "reservationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "origin" VARCHAR(256) NOT NULL,
  "browserDigest" VARCHAR(64) NOT NULL,
  "contactDigest" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HotelGuestReservationProof_pkey" PRIMARY KEY ("reservationId"),
  CONSTRAINT "HotelGuestReservationProof_reservation_fkey" FOREIGN KEY ("reservationId", "organizationId", "propertyId") REFERENCES "HotelReservation"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelGuestReservationProof_digest_check" CHECK ("browserDigest" ~ '^[0-9a-f]{64}$' AND "contactDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "HotelGuestReservationProof_expiry_check" CHECK ("expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "HotelGuestReservationProof_scope_key" ON "HotelGuestReservationProof"("reservationId", "organizationId", "propertyId");
CREATE INDEX "HotelGuestReservationProof_expiry_idx" ON "HotelGuestReservationProof"("organizationId", "propertyId", "expiresAt");
