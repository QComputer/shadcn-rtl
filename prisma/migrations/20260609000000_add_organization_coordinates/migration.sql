-- Add Organization coordinates expected by the Prisma schema.
-- IF NOT EXISTS keeps the migration safe for databases where these columns were added manually.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
