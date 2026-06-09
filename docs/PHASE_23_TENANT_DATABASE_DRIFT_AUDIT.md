# Phase 23 — Tenant / Database Drift Audit

Date: 2026-06-09

## Goal

P23 adds a small database-drift safety net after the P22 runtime issue where the generated Prisma Client expected `Organization.lat` / `Organization.lng`, but the live database did not physically contain those columns.

This phase does not add product features. It adds explicit operational visibility and a safe additive repair path for known schema drift.

## Added scripts

### `pnpm run db:drift`

Runs:

```bash
node scripts/quality/validate-database-drift.mjs
```

Checks the live PostgreSQL `information_schema.columns` for known schema columns that current code can read:

- `Organization.lat` as `double precision`
- `Organization.lng` as `double precision`
- `OrganizationSettings.deliveryFee` as `double precision`

If a column is missing or has the wrong physical type, the script fails and recommends the repair command.

### `pnpm run db:repair:known-drift`

Runs:

```bash
node scripts/db/repair-known-database-drift.mjs
```

Executes only safe additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` repairs for known drift:

```sql
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION DEFAULT 50000;
```

The SQL is also stored at:

```txt
scripts/db/known-database-drift-repair.sql
```

## Updated validators

`npm/pnpm run quality:local` now verifies that the P23 scripts and SQL file exist and that the JavaScript scripts parse successfully.

`quality:local` intentionally does not connect to the database. Database drift checks are a separate target/runtime validation step.

## Minimal target validation

Run this after applying P23:

```powershell
pnpm run db:drift
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

If `db:drift` fails with missing known columns, run:

```powershell
pnpm run db:repair:known-drift
pnpm run db:drift
```

Then rerun the remaining minimal validation.

## Remaining risks

- This is a targeted drift check, not a complete Prisma schema diff engine.
- It catches the known drift class that broke the shop route and delivery-fee calculation path.
- Broader tenant cleanup is still needed because the application still mixes `organizationId` and `organizationSlug` across some models and services.

## Next recommended phase

```txt
P24 — Tenant Boundary Cleanup Plan / Enforcement
```
