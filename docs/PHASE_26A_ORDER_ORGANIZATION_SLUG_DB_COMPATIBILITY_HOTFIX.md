# Phase 26A — Order Organization Slug DB Compatibility Hotfix

## Goal

Fix a runtime/build-time Prisma `P2022` database drift error where the current Prisma schema expects `Order.organizationSlug`, but the target database table is missing the physical column.

Observed error:

```txt
The column `Order.organizationSlug` does not exist in the current database.
```

## Changes

- Added migration:
  - `prisma/migrations/20260609002000_add_order_organization_slug/migration.sql`
- Updated known database drift detection:
  - `scripts/quality/validate-database-drift.mjs`
- Updated known drift repair SQL:
  - `scripts/db/known-database-drift-repair.sql`

## Migration behavior

The migration:

1. Adds `Order.organizationSlug` if missing.
2. Backfills from `Order.organizationId -> Organization.id` if an older `organizationId` column exists.
3. If there is exactly one active organization, backfills remaining NULL order rows to that organization.
4. Fails intentionally if any order rows still have NULL `organizationSlug`, so data is not silently assigned to the wrong tenant.
5. Marks the column `NOT NULL`.
6. Creates the index and foreign key if missing.

## Required validation

```bash
pnpm exec prisma migrate deploy
pnpm run db:drift
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Notes

This is a compatibility repair for a database whose migration history and physical schema drifted apart. It is not an appointment behavior change.
