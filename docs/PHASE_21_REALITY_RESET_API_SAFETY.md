# Phase 21 — Reality Reset and API Safety Closure

Date: 2026-06-08

## Goal

Phase 21 is a stabilization overlay. It closes the source/docs drift found during re-inspection and makes the concrete Phase 20 API/service safety claims true in the actual source tree.

This phase intentionally does not add new product features. It focuses on release safety, validator truth, and next-phase continuity.

## Implemented source changes

### Driver order mutation semantics

- `app/api/orders/[id]/driver/route.ts`
  - Removed the unsafe backward-compatible `GET -> POST` mutation alias.
  - `GET` now returns HTTP `405` and an `Allow` header.
  - `POST` accepts only order accept semantics.
  - Unsupported `POST` actions return `400`.
  - Added `PATCH` for undoing a previous driver denial.
  - `DELETE` remains the deny action.

### Order service consistency

- `lib/services/order.service.ts`
  - Delivery fee now uses `OrganizationSettings.deliveryFee ?? 0` instead of the old `deliveryRadius ? 20000 : 0` magic value.
  - Driver order listing now separates:
    - assigned orders scoped to the current `driverId`, and
    - available unassigned orders in driver-progress statuses.
  - Available driver orders exclude orders denied by the current driver.
  - Invalid/pseudo status filters are rejected with `Invalid order status filter`.
  - Driver list count now uses the same `orderWhere` predicate as the list query.

### Validation and UI request payloads

- `lib/validators/index.ts`
  - `updateOrderEstimatedEndTimeSchema.estimatedEndTime` now requires ISO datetime input.
  - `orderFilterSchema.status` now includes `CANCELLED`.
  - `updateOrganizationSettingsSchema` now accepts `deliveryFee`.
- `app/[locale]/dashboard/driver-orders/page.tsx`
  - Driver pickup/delivery estimated time payloads now send ISO strings.
- `app/[locale]/dashboard/orders/page.tsx`
  - Admin/manager preparation estimated time payloads now send ISO strings.

### Release artifact hygiene validator

- `scripts/quality/validate-release-artifact.mjs`
  - New validator for release/overlay artifacts.
  - Fails on common unsafe artifacts such as `.env`, local DB files, `.next`, `node_modules`, `test-results`, uploads, archive files, private keys, and personal public artifacts such as `public/myResume.pdf`.
- `package.json`
  - Added `quality:release-artifact` script.
- `scripts/quality/validate-project.mjs`
  - Now checks that the release artifact validator exists and has valid syntax.

## Documentation/source truth updates

- `README.md`
  - Phase 20/21 status now reflects the actual source after this overlay.
  - Missing Phase F documentation reference is restored by adding `docs/PHASE_F_LOCATION_TRACKING.md`.
- `docs/CURRENT_SOURCE_OF_TRUTH.md`
  - Added as the current completion-state handoff.

## Validation run in this environment

Passed:

```bash
node scripts/quality/validate-api-service-safety.mjs
node scripts/quality/validate-dashboard-access.mjs
npm run quality:local
node scripts/quality/validate-release-artifact.mjs <overlay-stage>
```

Not run here because this extracted ZIP does not include installed dependencies:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

Run those on the target machine after applying the overlay.

## Remaining known risks

- Several other GET routes still mutate state and belong in the next phase.
- Package/dependency alignment still needs a dedicated target-machine phase.
- i18n dictionaries remain incomplete across FA/EN/AR.
- Multi-tenant identity still mixes `organizationId` and `organizationSlug` in several areas.
- Real E2E coverage is still lighter than the project size requires.

## Recommended next phase

```txt
P22 — GET Purity and API Normalization
```

Scope should include removing DB writes from GET handlers, standardizing API error handling, and adding a validator that blocks GET handlers from calling create/update/upsert/delete or delegating to mutation handlers.
