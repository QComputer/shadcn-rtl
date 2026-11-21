ALTER TABLE "HotelDraftAccommodation"
    ADD COLUMN "promotedRoomId" TEXT,
    ADD COLUMN "promotedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "HotelDraftAccommodation_promoted_room_key"
    ON "HotelDraftAccommodation"("promotedRoomId");
