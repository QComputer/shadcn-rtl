# Current Source of Truth — Bazar Baz

Date: 2026-06-08

## Current project identity

Bazar Baz is a multi-tenant, multi-locale commerce and appointment-booking app built with Next.js 16, TypeScript, Prisma/PostgreSQL, NextAuth, Tailwind, and shadcn-style UI components.

## Current verified status after Phase 21 overlay

### Green in static/source validators

- Dashboard access validator passes.
- P20 API/service safety validator passes after Phase 21 fixes.
- Aggregate project validator passes.
- Release artifact hygiene validator exists and validates the changed-files overlay staging directory.

### Important source fixes now present

- Driver order `GET` no longer mutates and returns `405`.
- Driver accept is `POST`; driver deny is `DELETE`; driver undeny is `PATCH`.
- Order delivery fee uses `OrganizationSettings.deliveryFee ?? 0`.
- Driver order listing separates current-driver assigned orders from available unassigned orders.
- Pseudo order statuses such as driver-denial are rejected as filters rather than treated as Prisma `OrderStatus`.
- Order filters include `CANCELLED`.
- Estimated end-time updates require ISO datetime.
- Organization settings validation accepts `deliveryFee`.
- Dashboard order/driver-order pages send ISO datetime payloads for estimated-end-time updates.

## Not yet green / not yet proven in this environment

The uploaded ZIP does not include installed dependencies, so these must still be run on the target machine:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

## Must-not-ignore production risks

1. `.env`, `prisma/dev.db`, `test-results`, and personal/public files must not be shipped in release artifacts.
2. Several GET routes still perform writes/upserts/mark-read behavior and need API normalization.
3. Package/dependency versions need target-machine validation and cleanup.
4. i18n dictionaries are incomplete across FA/EN/AR.
5. Tenant identity is mixed between `organizationId` and `organizationSlug`.
6. Real E2E and concurrency coverage is not yet release-level.

## Recommended next phase

```txt
P22 — GET Purity and API Normalization
```

Do not add new business features before completing GET purity and API normalization.
