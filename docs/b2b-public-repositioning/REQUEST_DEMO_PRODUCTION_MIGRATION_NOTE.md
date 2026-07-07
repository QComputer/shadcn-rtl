# Request Demo Production Migration Note

## Migration Required

The `RequestDemoLead` model and `RequestDemoLeadStatus` enum were added in migration `20260707000100_request_demo_lead_storage`.

This migration must be applied to the production database before the request-demo lead capture workflow can be used in production.

## Local Validation

Local `db:validate` and `db:generate` pass without a live database connection because Prisma performs schema-only validation.

## Applying the Migration in Production

Run the following command against the production database:

```powershell
pnpm run db:migrate
```

Or if using Neon specifically:

```powershell
pnpm run db:migrate:neon
```

## FIX1 — ExportDataType Correction

A subsequent fix (BB-B2B-P10-FIX1) added `CUSTOMERS` and `FANPAGE_POSTS` to the `ExportDataType` enum via migration `20260707000200_export_hub_extend_data_types`.

Apply this migration to production as well:

```powershell
pnpm run db:migrate
```

## Rollback

To rollback the request-demo lead migration:

```powershell
npx prisma migrate resolve --rolled-back 20260707000100_request_demo_lead_storage
```

To rollback the ExportDataType extension:

```powershell
npx prisma migrate resolve --rolled-back 20260707000200_export_hub_extend_data_types
```

Then manually revert the Prisma schema changes if needed.

## Safety

- Both migrations are additive only (CREATE TABLE, CREATE TYPE, ALTER TYPE ADD VALUE).
- No existing data is modified.
- No existing tables are altered.
- The new table has foreign key constraints with `ON DELETE SET NULL`.

## Verification

After applying migrations, verify with:

```sql
SELECT to_regclass('public."RequestDemoLead"');
SELECT 'CUSTOMERS'::"ExportDataType";
SELECT 'FANPAGE_POSTS'::"ExportDataType";
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260707000100_request_demo_lead_storage',
  '20260707000200_export_hub_extend_data_types'
);
```

Expected results:
- `public."RequestDemoLead"`
- `CUSTOMERS`
- `FANPAGE_POSTS`
- Both migrations recorded with `finished_at` populated and `rolled_back_at` null

## Automated Migration Script

For environments where `prisma migrate deploy` cannot reach the database directly, use:

```powershell
node scripts/ops/apply-p10-migrations.mjs
```

This script:
- Uses `DATABASE_URL_UNPOOLED` (Direct Neon connection) to apply both migrations idempotently
- Records both migrations in `_prisma_migrations` history
- Verifies table existence, enum values, and migration history
- Does not expose database credentials in logs

## Actual Production Verification

Production database (Neon) verified on 2026-07-07:

- `RequestDemoLead` table: **EXISTS**
- `ExportDataType` enum: **PRODUCTS, PRODUCT_CATEGORIES, ORDERS, CUSTOMERS, FANPAGE_POSTS**
- Migration `20260707000100_request_demo_lead_storage`: **recorded, finished_at: 2026-07-07T17:12:34.444Z**
- Migration `20260707000200_export_hub_extend_data_types`: **recorded, finished_at: 2026-07-07T17:12:34.444Z**
- Lead count: 0 (no test data created)
- Deployed smoke: **passed** (`/fa/request-demo` returns 200, invalid POST returns 4xx, unauthenticated admin API blocked)
