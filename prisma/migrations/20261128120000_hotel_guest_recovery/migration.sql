-- Future opt-in bookings only. No historical credentials are generated.
CREATE TABLE "HotelGuestRecoveryCredential" (
  "reservationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "secretDigest" TEXT NOT NULL,
  "contactDigest" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "redeemedAt" TIMESTAMP(3),
  CONSTRAINT "HotelGuestRecoveryCredential_pkey" PRIMARY KEY ("reservationId"),
  CONSTRAINT "HotelGuestRecoveryCredential_reservation_fkey" FOREIGN KEY ("reservationId", "organizationId", "propertyId") REFERENCES "HotelReservation"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelGuestRecoveryCredential_digest_check" CHECK ("secretDigest" ~ '^[0-9a-f]{64}$' AND "contactDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "HotelGuestRecoveryCredential_expiry_check" CHECK ("expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "HotelGuestRecoveryCredential_scope_key" ON "HotelGuestRecoveryCredential"("reservationId", "organizationId", "propertyId");
CREATE INDEX "HotelGuestRecoveryCredential_expiry_idx" ON "HotelGuestRecoveryCredential"("organizationId", "propertyId", "expiresAt");
