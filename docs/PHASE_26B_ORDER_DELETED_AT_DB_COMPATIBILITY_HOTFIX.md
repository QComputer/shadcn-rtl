# Phase 26B — Order deletedAt DB Compatibility Hotfix

## Goal

Fix a runtime/build-time Prisma `P2022` database drift error where the current Prisma schema expects `Order.deletedAt`, but the target database table is missing the physical column.

Observed error:

```txt
The column `Order.deletedAt` does not exist in the current database.
```

## Changes

- Added migration:
  - `prisma/migrations/20260609003000_add_order_deleted_at/migration.sql`
- Updated known database drift detection:
  - `scripts/quality/validate-database-drift.mjs`
- Updated known drift repair SQL:
  - `scripts/db/known-database-drift-repair.sql`
- Updated aggregate source validator:
  - `scripts/quality/validate-project.mjs`

## Migration behavior

The migration:

1. Adds nullable `Order.deletedAt` if missing.
2. Creates `Order_deletedAt_idx` if missing.

This is additive and safe for existing rows.

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
