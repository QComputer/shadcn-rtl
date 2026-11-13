CREATE TABLE "HotelGuestBookingRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "trackingReferenceHash" TEXT NOT NULL,
  "idempotencyHash" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "checkIn" DATE NOT NULL,
  "checkOut" DATE NOT NULL,
  "adults" INTEGER NOT NULL,
  "children" INTEGER NOT NULL DEFAULT 0,
  "childAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "roomTypeSlug" TEXT,
  "ratePlanCode" TEXT,
  "availabilityHint" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "managerMessage" VARCHAR(500),
  "guestName" TEXT NOT NULL,
  "guestPhone" TEXT NOT NULL,
  "guestEmail" TEXT,
  "guestNote" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HotelGuestBookingRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelGuestBookingRequest_stay_check" CHECK ("checkOut" > "checkIn"),
  CONSTRAINT "HotelGuestBookingRequest_occupancy_check" CHECK (
    "adults" BETWEEN 1 AND 12 AND "children" BETWEEN 0 AND 12 AND CARDINALITY("childAges") = "children"
  ),
  CONSTRAINT "HotelGuestBookingRequest_status_check" CHECK (
    "status" IN ('RECEIVED', 'IN_REVIEW', 'OPTION_OFFERED', 'UNAVAILABLE', 'DECLINED', 'CLOSED')
  ),
  CONSTRAINT "HotelGuestBookingRequest_availability_check" CHECK (
    "availabilityHint" IN ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN')
  ),
  CONSTRAINT "HotelGuestBookingRequest_property_org_fkey" FOREIGN KEY ("propertyId", "organizationId")
    REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "HotelGuestBookingRequest_trackingReferenceHash_key" ON "HotelGuestBookingRequest"("trackingReferenceHash");
CREATE UNIQUE INDEX "HotelGuestBookingRequest_organizationId_idempotencyHash_key" ON "HotelGuestBookingRequest"("organizationId", "idempotencyHash");
CREATE UNIQUE INDEX "HotelGuestBookingRequest_id_organizationId_key" ON "HotelGuestBookingRequest"("id", "organizationId");
CREATE INDEX "HotelGuestBookingRequest_organizationId_propertyId_status_createdAt_idx"
  ON "HotelGuestBookingRequest"("organizationId", "propertyId", "status", "createdAt" DESC);
