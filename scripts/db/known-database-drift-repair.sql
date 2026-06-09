-- P23 known database drift repair
-- Safe additive repairs for databases whose migration history is marked applied
-- but whose physical schema is missing nullable/default columns used by current code.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION DEFAULT 50000;
