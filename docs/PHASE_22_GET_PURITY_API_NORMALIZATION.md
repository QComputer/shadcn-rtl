# Phase 22 — GET Purity and API Normalization

Date: 2026-06-09

## Goal

Phase 22 keeps API reads and writes separate. Public and private `GET` route handlers must not create, update, upsert, delete, or delegate to mutating handlers.

This is a stabilization phase, not a feature expansion phase.

## Implemented changes

### Dashboard notifications

- `GET /api/dashboard/notifications` is now read-only.
- Notification seen/read mutation moved to explicit `PATCH /api/dashboard/notifications`.
- Dashboard notification poller now calls `PATCH` after displaying fetched notifications.

### Organization payment settings

- `GET /api/organizations/[id]/payment` no longer creates missing payment settings.
- It returns existing settings or `{}`.
- Missing organization resolution now returns `404` instead of an implicit empty response.

### Organization settings

- `GET /api/organizations/[id]/settings` no longer uses `upsert`.
- It returns existing settings when present.
- If settings are missing, it returns a read-only default response composed with organization data, without writing to the database.
- `PUT` remains the explicit write/upsert path.

### Public shop settings

- `GET /api/public/organizations/[slug]/shop` no longer creates `OrganizationSettings` or `PaymentSettings`.
- It returns existing settings when present.
- If settings are missing, it returns read-only default settings combined with organization data.
- It removes the previous duplicate `OrganizationSettings.create` risk when payment settings were missing.

### Driver order route normalization

- `GET /api/orders/[id]/driver` returns `405` instead of delegating to `POST`.
- Accept remains `POST`, deny remains `DELETE`, and undeny remains `PATCH`.

### Organization open/close UI alignment

- The organization settings page now uses explicit `POST /api/organizations/open` with `{ isOpen: true }` when opening the shop.
- This preserves the earlier P20 API rule that `GET /api/organizations/open` is read-only.

### GET purity validator

- Added `scripts/quality/validate-get-purity.mjs`.
- The validator fails when an API `GET` handler contains:
  - `.create(` / `.createMany(`
  - `.update(` / `.updateMany(`
  - `.upsert(`
  - `.delete(` / `.deleteMany(`
  - `return POST(` / `return PUT(` / `return PATCH(` / `return DELETE(`
- `scripts/quality/validate-project.mjs` now runs the GET purity validator.
- `package.json` adds `quality:get-purity`.

## Validation run in sandbox

Passed:

```bash
node scripts/quality/validate-get-purity.mjs
node scripts/quality/validate-api-service-safety.mjs
node scripts/quality/validate-project.mjs
node scripts/quality/validate-release-artifact.mjs /mnt/data/bazar_baz_p22_overlay_stage
```

Target-machine required minimum after applying overlay:

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Known remaining risks

- Full lint remains intentionally outside the minimal stabilization gate because the existing codebase has large legacy lint debt.
- Several APIs still need broader response/error-style normalization in a later phase.
- Tenant scoping still needs a dedicated phase, especially where organization ID and slug are mixed.
