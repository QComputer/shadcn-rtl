-- Additive staff-only waitlist. No backfill or inventory/financial writes.
CREATE TABLE "HotelReceptionWaitlist" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "guestName" VARCHAR(160) NOT NULL,
  "phone" VARCHAR(24) NOT NULL,
  "checkIn" DATE NOT NULL,
  "checkOut" DATE NOT NULL,
  "adults" INTEGER NOT NULL,
  "childAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "status" TEXT NOT NULL DEFAULT 'WAITING',
  "version" INTEGER NOT NULL DEFAULT 0,
  "requestKey" VARCHAR(100) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "reservationReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HotelReceptionWaitlist_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelReceptionWaitlist_property_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelReceptionWaitlist_room_type_fkey" FOREIGN KEY ("roomTypeId", "propertyId") REFERENCES "HotelRoomType"("id", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelReceptionWaitlist_status_check" CHECK ("status" IN ('WAITING','CONTACTED','BOOKED','CANCELLED','EXPIRED')),
  CONSTRAINT "HotelReceptionWaitlist_dates_check" CHECK ("checkOut" > "checkIn" AND "adults" >= 1 AND "version" >= 0),
  CONSTRAINT "HotelReceptionWaitlist_booking_check" CHECK (("status" = 'BOOKED') = ("reservationReference" IS NOT NULL))
);
CREATE UNIQUE INDEX "HotelReceptionWaitlist_request_key" ON "HotelReceptionWaitlist"("organizationId", "propertyId", "requestKey");
CREATE UNIQUE INDEX "HotelReceptionWaitlist_reservation_key" ON "HotelReceptionWaitlist"("organizationId", "propertyId", "reservationReference");
CREATE INDEX "HotelReceptionWaitlist_scope_idx" ON "HotelReceptionWaitlist"("organizationId", "propertyId", "status", "checkIn", "createdAt", "id");
