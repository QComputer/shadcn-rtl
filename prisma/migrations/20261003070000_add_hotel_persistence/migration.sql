-- =============================================================================
-- H3-B1: Hotel persistence.
-- Applies AFTER 20261003060000_add_organization_vertical_and_hotel_booking_capability.
--
-- Additive only. This file contains NO DROP, NO ALTER COLUMN and NO reference to
-- any non-hotel table.
--
-- PART 1 is hotel-only DDL, extracted from a full `prisma migrate diff` that ALSO
-- proposed destructive changes to OrganizationBranding (9 columns) and
-- Organization_isPlatformOwner_idx. Those arise from PRE-EXISTING datamodel/migration
-- drift unrelated to hotels and are DELIBERATELY EXCLUDED here. Applying them
-- would silently destroy tenant branding data. See
-- docs/SCHEMA-MIGRATION-DRIFT-REVIEW.md.
--
-- PART 2 adds integrity constraints Prisma cannot express.
--
-- Ownership: every child carries organizationId and references its parent with a
-- composite FK. Room types are additionally scoped to their PROPERTY
-- ([roomTypeId, propertyId]), so inventory or a rate plan cannot reference a room
-- type belonging to a sibling property.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================ PART 1: Hotel tables ============================
-- CreateTable
CREATE TABLE "HotelProperty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationSlug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "currency" TEXT NOT NULL DEFAULT 'TOMAN',
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "minStayNights" INTEGER NOT NULL DEFAULT 1,
    "maxStayNights" INTEGER NOT NULL DEFAULT 30,
    "addressLine1" TEXT,
    "city" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HotelProperty_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelRoomType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxAdults" INTEGER NOT NULL,
    "maxChildren" INTEGER NOT NULL DEFAULT 0,
    "maxOccupancy" INTEGER NOT NULL,
    "beds" JSONB NOT NULL,
    "sizeSqm" INTEGER,
    "totalAllotment" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HotelRoomType_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelRoom" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HotelRoom_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelAmenity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelAmenity_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelRoomTypeAmenity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "HotelRoomTypeAmenity_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelRatePlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TOMAN',
    "baseNightlyRate" BIGINT NOT NULL,
    "mealPlan" TEXT NOT NULL DEFAULT 'none',
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "maxNights" INTEGER NOT NULL DEFAULT 0,
    "isRefundable" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" DATE,
    "validTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRatePlan_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelNightlyRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "nightlyRate" BIGINT,
    "minNights" INTEGER,
    "maxNights" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelNightlyRate_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelCancellationPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "freeCancellationCutoffHours" INTEGER NOT NULL,
    "fullCancellationRetention" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelCancellationPolicy_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelInventory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "allotment" INTEGER NOT NULL DEFAULT 0,
    "booked" INTEGER NOT NULL DEFAULT 0,
    "held" INTEGER NOT NULL DEFAULT 0,
    "outOfService" INTEGER NOT NULL DEFAULT 0,
    "closedToArrival" BOOLEAN NOT NULL DEFAULT false,
    "closedToDeparture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelInventory_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelInventoryAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "allotmentDelta" INTEGER NOT NULL DEFAULT 0,
    "outOfServiceDelta" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelInventoryAdjustment_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelBookingHold" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelBookingHold_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelReservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TOMAN',
    "totalAmount" BIGINT NOT NULL,
    "paidAmount" BIGINT NOT NULL DEFAULT 0,
    "refundedAmount" BIGINT NOT NULL DEFAULT 0,
    "cancellationPolicyKey" TEXT NOT NULL,
    "cancellationPolicySnapshot" JSONB NOT NULL,
    "guestCustomerId" TEXT,
    "holdId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HotelReservation_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelReservationRoom" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "roomId" TEXT,
    "rate" BIGINT NOT NULL,

    CONSTRAINT "HotelReservationRoom_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelReservationGuest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isChild" BOOLEAN NOT NULL DEFAULT false,
    "age" INTEGER,
    "phoneHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelReservationGuest_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "HotelPaymentAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelReservationId" TEXT NOT NULL,
    "paymentRequestPublicId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountToman" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelPaymentAllocation_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "HotelProperty_organizationId_isActive_idx" ON "HotelProperty"("organizationId", "isActive");


-- CreateIndex
CREATE UNIQUE INDEX "HotelProperty_organizationId_slug_key" ON "HotelProperty"("organizationId", "slug");


-- CreateIndex
CREATE UNIQUE INDEX "HotelProperty_id_organizationId_key" ON "HotelProperty"("id", "organizationId");


-- CreateIndex
CREATE INDEX "HotelRoomType_organizationId_propertyId_isActive_idx" ON "HotelRoomType"("organizationId", "propertyId", "isActive");


-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomType_propertyId_slug_key" ON "HotelRoomType"("propertyId", "slug");


-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomType_id_organizationId_key" ON "HotelRoomType"("id", "organizationId");


-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomType_id_propertyId_key" ON "HotelRoomType"("id", "propertyId");


-- CreateIndex
CREATE INDEX "HotelRoom_organizationId_roomTypeId_isActive_idx" ON "HotelRoom"("organizationId", "roomTypeId", "isActive");


-- CreateIndex
CREATE UNIQUE INDEX "HotelRoom_propertyId_code_key" ON "HotelRoom"("propertyId", "code");


-- CreateIndex
CREATE UNIQUE INDEX "HotelRoom_id_organizationId_key" ON "HotelRoom"("id", "organizationId");


-- CreateIndex
CREATE INDEX "HotelAmenity_organizationId_propertyId_isActive_idx" ON "HotelAmenity"("organizationId", "propertyId", "isActive");


-- CreateIndex
CREATE UNIQUE INDEX "HotelAmenity_propertyId_key_key" ON "HotelAmenity"("propertyId", "key");


-- CreateIndex
CREATE UNIQUE INDEX "HotelAmenity_id_organizationId_key" ON "HotelAmenity"("id", "organizationId");


-- CreateIndex
CREATE INDEX "HotelRoomTypeAmenity_organizationId_amenityId_idx" ON "HotelRoomTypeAmenity"("organizationId", "amenityId");


-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomTypeAmenity_roomTypeId_amenityId_key" ON "HotelRoomTypeAmenity"("roomTypeId", "amenityId");


-- CreateIndex
CREATE INDEX "HotelRatePlan_organizationId_propertyId_roomTypeId_isActive_idx" ON "HotelRatePlan"("organizationId", "propertyId", "roomTypeId", "isActive");


-- CreateIndex
CREATE UNIQUE INDEX "HotelRatePlan_propertyId_code_key" ON "HotelRatePlan"("propertyId", "code");


-- CreateIndex
CREATE UNIQUE INDEX "HotelRatePlan_id_organizationId_key" ON "HotelRatePlan"("id", "organizationId");


-- CreateIndex
CREATE INDEX "HotelNightlyRate_organizationId_propertyId_from_to_idx" ON "HotelNightlyRate"("organizationId", "propertyId", "from", "to");


-- CreateIndex
CREATE UNIQUE INDEX "HotelNightlyRate_ratePlanId_from_to_key" ON "HotelNightlyRate"("ratePlanId", "from", "to");


-- CreateIndex
CREATE INDEX "HotelCancellationPolicy_organizationId_propertyId_isActive_idx" ON "HotelCancellationPolicy"("organizationId", "propertyId", "isActive");


-- CreateIndex
CREATE UNIQUE INDEX "HotelCancellationPolicy_propertyId_key_key" ON "HotelCancellationPolicy"("propertyId", "key");


-- CreateIndex
CREATE UNIQUE INDEX "HotelCancellationPolicy_id_organizationId_key" ON "HotelCancellationPolicy"("id", "organizationId");


-- CreateIndex
CREATE INDEX "HotelInventory_organizationId_propertyId_date_idx" ON "HotelInventory"("organizationId", "propertyId", "date");


-- CreateIndex
CREATE UNIQUE INDEX "HotelInventory_roomTypeId_date_key" ON "HotelInventory"("roomTypeId", "date");


-- CreateIndex
CREATE INDEX "HotelInventoryAdjustment_organizationId_propertyId_date_idx" ON "HotelInventoryAdjustment"("organizationId", "propertyId", "date");


-- CreateIndex
CREATE INDEX "HotelBookingHold_status_expiresAt_idx" ON "HotelBookingHold"("status", "expiresAt");


-- CreateIndex
CREATE INDEX "HotelBookingHold_organizationId_propertyId_status_expiresAt_idx" ON "HotelBookingHold"("organizationId", "propertyId", "status", "expiresAt");


-- CreateIndex
CREATE UNIQUE INDEX "HotelBookingHold_organizationId_reference_key" ON "HotelBookingHold"("organizationId", "reference");


-- CreateIndex
CREATE UNIQUE INDEX "HotelBookingHold_id_organizationId_key" ON "HotelBookingHold"("id", "organizationId");


-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_holdId_key" ON "HotelReservation"("holdId");


-- CreateIndex
CREATE INDEX "HotelReservation_organizationId_status_createdAt_idx" ON "HotelReservation"("organizationId", "status", "createdAt");


-- CreateIndex
CREATE INDEX "HotelReservation_organizationId_propertyId_checkIn_checkOut_idx" ON "HotelReservation"("organizationId", "propertyId", "checkIn", "checkOut");


-- CreateIndex
CREATE INDEX "HotelReservation_organizationId_holdId_idx" ON "HotelReservation"("organizationId", "holdId");


-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_organizationId_reference_key" ON "HotelReservation"("organizationId", "reference");


-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_organizationId_idempotencyKey_key" ON "HotelReservation"("organizationId", "idempotencyKey");


-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_id_organizationId_key" ON "HotelReservation"("id", "organizationId");


-- CreateIndex
CREATE INDEX "HotelReservationRoom_organizationId_date_roomTypeId_idx" ON "HotelReservationRoom"("organizationId", "date", "roomTypeId");


-- CreateIndex
CREATE INDEX "HotelReservationRoom_organizationId_reservationId_idx" ON "HotelReservationRoom"("organizationId", "reservationId");


-- CreateIndex
CREATE UNIQUE INDEX "HotelReservationRoom_reservationId_date_key" ON "HotelReservationRoom"("reservationId", "date");


-- CreateIndex
CREATE UNIQUE INDEX "HotelReservationRoom_roomId_date_key" ON "HotelReservationRoom"("roomId", "date");


-- CreateIndex
CREATE INDEX "HotelReservationGuest_organizationId_reservationId_idx" ON "HotelReservationGuest"("organizationId", "reservationId");


-- CreateIndex
CREATE UNIQUE INDEX "HotelReservationGuest_reservationId_fullName_key" ON "HotelReservationGuest"("reservationId", "fullName");


-- CreateIndex
CREATE UNIQUE INDEX "HotelPaymentAllocation_paymentRequestPublicId_key" ON "HotelPaymentAllocation"("paymentRequestPublicId");


-- CreateIndex
CREATE INDEX "HotelPaymentAllocation_organizationId_hotelReservationId_idx" ON "HotelPaymentAllocation"("organizationId", "hotelReservationId");


-- CreateIndex
CREATE UNIQUE INDEX "HotelPaymentAllocation_hotelReservationId_kind_key" ON "HotelPaymentAllocation"("hotelReservationId", "kind");


-- AddForeignKey
ALTER TABLE "HotelProperty" ADD CONSTRAINT "HotelProperty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelRoomType" ADD CONSTRAINT "HotelRoomType_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_roomTypeId_propertyId_fkey" FOREIGN KEY ("roomTypeId", "propertyId") REFERENCES "HotelRoomType"("id", "propertyId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelAmenity" ADD CONSTRAINT "HotelAmenity_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelRoomTypeAmenity" ADD CONSTRAINT "HotelRoomTypeAmenity_roomTypeId_organizationId_fkey" FOREIGN KEY ("roomTypeId", "organizationId") REFERENCES "HotelRoomType"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelRoomTypeAmenity" ADD CONSTRAINT "HotelRoomTypeAmenity_amenityId_organizationId_fkey" FOREIGN KEY ("amenityId", "organizationId") REFERENCES "HotelAmenity"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelRatePlan" ADD CONSTRAINT "HotelRatePlan_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelRatePlan" ADD CONSTRAINT "HotelRatePlan_roomTypeId_propertyId_fkey" FOREIGN KEY ("roomTypeId", "propertyId") REFERENCES "HotelRoomType"("id", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelNightlyRate" ADD CONSTRAINT "HotelNightlyRate_ratePlanId_organizationId_fkey" FOREIGN KEY ("ratePlanId", "organizationId") REFERENCES "HotelRatePlan"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelCancellationPolicy" ADD CONSTRAINT "HotelCancellationPolicy_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelInventory" ADD CONSTRAINT "HotelInventory_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelInventory" ADD CONSTRAINT "HotelInventory_roomTypeId_propertyId_fkey" FOREIGN KEY ("roomTypeId", "propertyId") REFERENCES "HotelRoomType"("id", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelInventoryAdjustment" ADD CONSTRAINT "HotelInventoryAdjustment_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelBookingHold" ADD CONSTRAINT "HotelBookingHold_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelBookingHold" ADD CONSTRAINT "HotelBookingHold_roomTypeId_propertyId_fkey" FOREIGN KEY ("roomTypeId", "propertyId") REFERENCES "HotelRoomType"("id", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_roomTypeId_propertyId_fkey" FOREIGN KEY ("roomTypeId", "propertyId") REFERENCES "HotelRoomType"("id", "propertyId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "HotelBookingHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelReservationRoom" ADD CONSTRAINT "HotelReservationRoom_reservationId_organizationId_fkey" FOREIGN KEY ("reservationId", "organizationId") REFERENCES "HotelReservation"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelReservationRoom" ADD CONSTRAINT "HotelReservationRoom_roomId_organizationId_fkey" FOREIGN KEY ("roomId", "organizationId") REFERENCES "HotelRoom"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelReservationGuest" ADD CONSTRAINT "HotelReservationGuest_reservationId_organizationId_fkey" FOREIGN KEY ("reservationId", "organizationId") REFERENCES "HotelReservation"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "HotelPaymentAllocation" ADD CONSTRAINT "HotelPaymentAllocation_hotelReservationId_organizationId_fkey" FOREIGN KEY ("hotelReservationId", "organizationId") REFERENCES "HotelReservation"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- ====================== PART 2: integrity constraints =========================

ALTER TABLE "HotelInventory"
  ADD CONSTRAINT "hotel_inventory_non_negative"
  CHECK (allotment >= 0 AND booked >= 0 AND held >= 0 AND "outOfService" >= 0);

ALTER TABLE "HotelInventory"
  ADD CONSTRAINT "hotel_inventory_not_oversold"
  CHECK (booked + held + "outOfService" <= allotment);

ALTER TABLE "HotelRatePlan"
  ADD CONSTRAINT "hotel_rate_plan_non_negative" CHECK ("baseNightlyRate" >= 0);

ALTER TABLE "HotelRatePlan"
  ADD CONSTRAINT "hotel_rate_plan_stay_window"
  CHECK ("minNights" >= 1 AND ("maxNights" = 0 OR "maxNights" >= "minNights"));

-- `from` and `to` are SQL reserved words and MUST be quoted.
-- `nightlyRate` is camelCase and MUST be quoted.
ALTER TABLE "HotelNightlyRate"
  ADD CONSTRAINT "hotel_nightly_rate_window" CHECK ("to" >= "from");

ALTER TABLE "HotelNightlyRate"
  ADD CONSTRAINT "hotel_nightly_rate_non_negative"
  CHECK ("nightlyRate" IS NULL OR "nightlyRate" >= 0);

ALTER TABLE "HotelCancellationPolicy"
  ADD CONSTRAINT "hotel_policy_retention_basis_points"
  CHECK ("fullCancellationRetention" BETWEEN 0 AND 10000);

ALTER TABLE "HotelCancellationPolicy"
  ADD CONSTRAINT "hotel_policy_cutoff_non_negative"
  CHECK ("freeCancellationCutoffHours" >= 0);

ALTER TABLE "HotelReservation"
  ADD CONSTRAINT "hotel_reservation_money"
  CHECK ("totalAmount" >= 0 AND "paidAmount" >= 0 AND "refundedAmount" >= 0
         AND "refundedAmount" <= "paidAmount");

-- Stay window: checkout is EXCLUSIVE and must follow check-in.
ALTER TABLE "HotelReservation"
  ADD CONSTRAINT "hotel_reservation_window" CHECK ("checkOut" > "checkIn");

ALTER TABLE "HotelBookingHold"
  ADD CONSTRAINT "hotel_hold_window" CHECK ("checkOut" > "checkIn" AND quantity > 0);

ALTER TABLE "HotelRoomType"
  ADD CONSTRAINT "hotel_room_type_occupancy"
  CHECK ("maxAdults" >= 1 AND "maxChildren" >= 0
         AND "maxOccupancy" >= "maxAdults"
         AND "maxOccupancy" >= 1);

ALTER TABLE "HotelProperty"
  ADD CONSTRAINT "hotel_property_stay_window"
  CHECK ("minStayNights" >= 1 AND "maxStayNights" >= "minStayNights");

ALTER TABLE "HotelReservationRoom"
  ADD CONSTRAINT "hotel_reservation_night_rate" CHECK (rate >= 0);

-- A physical room cannot be double-allocated on one night.
-- Scope: TWO REAL COLUMNS OF THE SAME TABLE. Enforces nothing across tables, does
-- not manage inventory counts, and does not release anything when a reservation is
-- cancelled (that is H3-C work: delete the reservation's night rows).
-- There is deliberately NO now() predicate anywhere in this migration.
ALTER TABLE "HotelReservationRoom"
  ADD CONSTRAINT "hotel_room_not_double_booked"
  EXCLUDE USING gist ("roomId" WITH =, "date" WITH =)
  WHERE ("roomId" IS NOT NULL);