-- P26B database compatibility repair
-- Some migrated databases have Prisma migration history marked applied while the physical
-- Order table is missing deletedAt. Current Prisma schema and relation queries may select
-- Order.deletedAt during organization/home page loading.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_deletedAt_idx"
ON "Order"("deletedAt");
