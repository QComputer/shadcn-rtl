ALTER TABLE "HotelGuestBookingRequest"
  ADD COLUMN "preferredCategory" TEXT,
  ADD CONSTRAINT "HotelGuestBookingRequest_preferred_category_check"
  CHECK (
    "preferredCategory" IS NULL OR (
      "roomTypeSlug" IS NULL AND "ratePlanCode" IS NULL
      AND "preferredCategory" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      AND length("preferredCategory") <= 80
    )
  );
