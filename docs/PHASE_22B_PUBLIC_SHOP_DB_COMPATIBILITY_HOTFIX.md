# Phase 22B — Public Shop DB Compatibility Hotfix

Date: 2026-06-09

## Goal

Fix a runtime Prisma `P2022` crash on the public shop API when the deployed database does not yet contain newer `Organization.lat` / `Organization.lng` columns.

## Problem

`GET /api/public/organizations/[slug]/shop` loaded `organizationSettings.organization` and `organization.paymentSettings` through Prisma relation includes. Because the Prisma schema contains newer `Organization.lat` / `Organization.lng` fields, Prisma selected those columns while resolving the relation. Older/current databases without those columns crashed with:

```txt
The column `Organization.lat` does not exist in the current database.
```

## Implemented fix

- `prisma/migrations/20260609000000_add_organization_coordinates/migration.sql`
  - Adds missing nullable `Organization.lat` and `Organization.lng` columns expected by the Prisma schema.
  - Uses `IF NOT EXISTS` so it is safe for databases where the columns already exist.
- `app/api/public/organizations/[slug]/shop/route.ts`
  - Removed `organization` relation loading from `organizationSettings.findUnique()`.
  - Replaced full `organization.findUnique({ include: { paymentSettings: true } })` with an explicit safe public field `select` that excludes `lat` / `lng`.
  - Loaded `paymentSettings` independently with an explicit field `select`.
  - Preserved read-only GET behavior from P22.

## Validation run in sandbox

```bash
node scripts/quality/validate-get-purity.mjs
node scripts/quality/validate-api-service-safety.mjs
node scripts/quality/validate-project.mjs
```

All passed.

## Required target validation

```powershell
pnpm exec prisma migrate deploy
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

Then manually reload the affected route/page:

```txt
/fa/shop/chakme
/api/public/organizations/leo/shop
```

## Notes

The missing `/uploads/...jpg` 404 is separate from this Prisma crash and means the referenced image file is not present in local upload storage.
