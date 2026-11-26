-- Additive reception-only person dossiers. No backfill or automatic identity matching.
CREATE UNIQUE INDEX "HotelReservation_profile_scope_key" ON "HotelReservation"("id", "organizationId", "propertyId");
CREATE UNIQUE INDEX "HotelReservationGuest_profile_scope_key" ON "HotelReservationGuest"("id", "reservationId", "organizationId");
CREATE TABLE "HotelGuestProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "displayName" VARCHAR(160) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HotelGuestProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelGuestProfile_property_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelGuestProfile_scope_key" ON "HotelGuestProfile"("id", "organizationId", "propertyId");
CREATE INDEX "HotelGuestProfile_scope_updated_idx" ON "HotelGuestProfile"("organizationId", "propertyId", "updatedAt", "id");
CREATE TABLE "HotelGuestProfileLink" (
  "guestId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "linkedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelGuestProfileLink_pkey" PRIMARY KEY ("guestId"),
  CONSTRAINT "HotelGuestProfileLink_guest_fkey" FOREIGN KEY ("guestId", "reservationId", "organizationId") REFERENCES "HotelReservationGuest"("id", "reservationId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelGuestProfileLink_reservation_fkey" FOREIGN KEY ("reservationId", "organizationId", "propertyId") REFERENCES "HotelReservation"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelGuestProfileLink_profile_fkey" FOREIGN KEY ("profileId", "organizationId", "propertyId") REFERENCES "HotelGuestProfile"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelGuestProfileLink_guest_scope_key" ON "HotelGuestProfileLink"("guestId", "reservationId", "organizationId");
CREATE UNIQUE INDEX "HotelGuestProfileLink_one_person_per_stay_key" ON "HotelGuestProfileLink"("profileId", "reservationId");
CREATE INDEX "HotelGuestProfileLink_scope_idx" ON "HotelGuestProfileLink"("organizationId", "propertyId", "profileId", "createdAt", "guestId");
