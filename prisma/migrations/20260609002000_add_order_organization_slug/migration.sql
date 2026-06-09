-- P26A database compatibility repair
-- Some migrated databases have Prisma migration history marked applied while the physical
-- Order table is missing organizationSlug. Current Prisma schema and home/shop queries
-- require this column.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "organizationSlug" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name = 'organizationId'
  ) THEN
    EXECUTE 'UPDATE "Order" AS o
      SET "organizationSlug" = org."slug"
      FROM "Organization" AS org
      WHERE o."organizationSlug" IS NULL
        AND o."organizationId" = org."id"';
  END IF;
END $$;

WITH active_org_count AS (
  SELECT COUNT(*)::integer AS count
  FROM "Organization"
  WHERE "deletedAt" IS NULL
), single_active_org AS (
  SELECT "slug"
  FROM "Organization"
  WHERE "deletedAt" IS NULL
  ORDER BY "createdAt" ASC
  LIMIT 1
)
UPDATE "Order"
SET "organizationSlug" = (SELECT "slug" FROM single_active_org)
WHERE "organizationSlug" IS NULL
  AND (SELECT count FROM active_org_count) = 1;

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO missing_count
  FROM "Order"
  WHERE "organizationSlug" IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Cannot mark Order.organizationSlug NOT NULL: % order rows still have NULL organizationSlug. Populate them manually before rerunning this migration.', missing_count;
  END IF;
END $$;

ALTER TABLE "Order" ALTER COLUMN "organizationSlug" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Order_organizationSlug_idx"
ON "Order"("organizationSlug");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_organizationSlug_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_organizationSlug_fkey"
      FOREIGN KEY ("organizationSlug") REFERENCES "Organization"("slug")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
