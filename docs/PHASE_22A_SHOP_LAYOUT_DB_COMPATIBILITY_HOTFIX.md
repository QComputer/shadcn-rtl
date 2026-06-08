# Phase 22A — Shop Layout DB Compatibility Hotfix

Date: 2026-06-08

## Goal

Fix a runtime Prisma P2022 error on `GET /[locale]/shop/[slug]` when the current database has not yet been migrated with `Organization.lat` and `Organization.lng` columns.

## Issue

The shop layout selected `Organization.lat` and `Organization.lng` to render the shop location button. On the target database, those columns do not exist yet, so Prisma raised:

```txt
The column `Organization.lat` does not exist in the current database.
```

## Implemented fix

- `app/[locale]/shop/[slug]/layout.tsx`
  - Removed `lat`/`lng` from the Prisma `organization.findUnique` select.
  - Removed the shop-location button render from the server layout.
  - Kept the layout compatible with the current database schema deployed on the target machine.

## Notes

- This is a defensive runtime compatibility fix.
- The separate `components/shop/shop-location-dialog.tsx` client component can remain available for a future location phase, but the server layout must not query columns that are not guaranteed to exist in the current database.
- The `/uploads/...jpg 404` log is separate: it indicates a missing uploaded asset file, not this Prisma runtime crash.

## Required target validation

```bash
pnpm run typecheck
pnpm run build
pnpm run quality:local
```
