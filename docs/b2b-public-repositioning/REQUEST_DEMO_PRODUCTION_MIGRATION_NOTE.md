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

## Rollback

The migration includes a `down.sql` that drops the enum and table. To rollback:

```powershell
npx prisma migrate resolve --rolled-back 20260707000100_request_demo_lead_storage
```

Then manually revert the Prisma schema changes if needed.

## Safety

- This migration is additive only (CREATE TABLE, CREATE TYPE).
- No existing data is modified.
- No existing tables are altered.
- The new table has foreign key constraints with `ON DELETE SET NULL`.
