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
```

Expected results:
- `public."RequestDemoLead"`
- `CUSTOMERS`
- `FANPAGE_POSTS`
