CREATE TABLE "HotelDraftAccommodation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "temporaryCode" VARCHAR(80) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "floor" VARCHAR(80),
    "layout" VARCHAR(500),
    "description" VARCHAR(4000),
    "estimatedMinGuests" INTEGER,
    "estimatedMaxGuests" INTEGER,
    "maxAdults" INTEGER,
    "maxChildren" INTEGER,
    "maxOccupancy" INTEGER,
    "beds" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelDraftAccommodation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HotelDraftAccommodation_estimates_check" CHECK (
        ("estimatedMinGuests" IS NULL AND "estimatedMaxGuests" IS NULL)
        OR ("estimatedMinGuests" IS NOT NULL AND "estimatedMaxGuests" IS NOT NULL
            AND "estimatedMinGuests" BETWEEN 1 AND "estimatedMaxGuests" AND "estimatedMaxGuests" <= 100)
    ),
    CONSTRAINT "HotelDraftAccommodation_occupancy_check" CHECK (
        ("maxAdults" IS NULL OR "maxAdults" BETWEEN 1 AND 100)
        AND ("maxChildren" IS NULL OR "maxChildren" BETWEEN 0 AND 100)
        AND ("maxOccupancy" IS NULL OR (
            "maxOccupancy" BETWEEN 1 AND 100
            AND "maxOccupancy" >= COALESCE("maxAdults", 0)
            AND "maxOccupancy" >= COALESCE("maxChildren", 0)
        ))
    )
);

CREATE UNIQUE INDEX "HotelDraftAccommodation_scope_code_key"
    ON "HotelDraftAccommodation"("organizationId", "propertyId", "temporaryCode");
CREATE INDEX "HotelDraftAccommodation_scope_archived_idx"
    ON "HotelDraftAccommodation"("organizationId", "propertyId", "archivedAt");

ALTER TABLE "HotelDraftAccommodation" ADD CONSTRAINT "HotelDraftAccommodation_property_scope_fkey"
    FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE;
