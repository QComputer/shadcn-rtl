ALTER TABLE "HotelReservation"
  ADD COLUMN "adults" INTEGER,
  ADD COLUMN "children" INTEGER,
  ADD COLUMN "childAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "HotelReservation"
  ADD CONSTRAINT "HotelReservation_occupancy_valid"
  CHECK (
    ("adults" IS NULL AND "children" IS NULL)
    OR ("adults" > 0 AND "children" >= 0 AND cardinality("childAges") = "children")
  );
