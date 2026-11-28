CREATE TABLE "HotelReservationOwnership" (
  "reservationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelReservationOwnership_pkey" PRIMARY KEY ("reservationId"),
  CONSTRAINT "HotelReservationOwnership_reservation_fkey" FOREIGN KEY ("reservationId", "organizationId", "propertyId") REFERENCES "HotelReservation"("id", "organizationId", "propertyId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HotelReservationOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelReservationOwnership_scope_key" ON "HotelReservationOwnership"("reservationId", "organizationId", "propertyId");
CREATE INDEX "HotelReservationOwnership_organizationId_userId_claimedAt_idx" ON "HotelReservationOwnership"("organizationId", "userId", "claimedAt");
