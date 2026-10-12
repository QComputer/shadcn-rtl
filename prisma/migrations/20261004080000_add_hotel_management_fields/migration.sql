-- H3-C2 additive management fields. No existing columns or accepted migrations
-- are altered; reservation snapshots remain authoritative for historical data.
ALTER TABLE "HotelProperty" ADD COLUMN "localizedContent" JSONB;
ALTER TABLE "HotelRoomType" ADD COLUMN "localizedContent" JSONB;
ALTER TABLE "HotelRoom" ADD COLUMN "description" TEXT;
ALTER TABLE "HotelRoom" ADD COLUMN "isOutOfService" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HotelAmenity" ADD COLUMN "localizedContent" JSONB;
ALTER TABLE "HotelRatePlan" ADD COLUMN "localizedContent" JSONB;
ALTER TABLE "HotelCancellationPolicy" ADD COLUMN "localizedContent" JSONB;
ALTER TABLE "HotelCancellationPolicy" ADD COLUMN "cancellationTiers" JSONB;
