# Current Source of Truth — Bazar Baz

Date: 2026-06-09

## Current validated baseline

The current stabilization baseline has passed the minimum target-machine gate reported by the user:

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Completed stabilization state

### P21/P21A/P21B

- API/service safety validator is green.
- Prisma generate/validate, typecheck, build, and quality local were brought back to green under pnpm.
- pnpm is the active package manager for this project.
- Direct dependencies required by source imports were added.
- The shop layout dynamic-map build issue was fixed by moving `ssr:false` dynamic import into a Client Component.

### P22

- API `GET` handlers covered by the phase no longer perform database writes or delegate to mutation handlers.
- Dashboard notification read and mark-seen behavior is split into `GET` and `PATCH`.
- Organization settings/payment public reads no longer bootstrap rows during `GET`.
- Public shop `GET` no longer creates settings/payment settings and no longer risks duplicate settings creation when payment settings are missing.
- Organization open/close UI uses explicit `POST` for the open action instead of relying on read-only `GET`.
- A GET purity validator is now part of `quality:local`.


### P22B

- Added migration `20260609000000_add_organization_coordinates` for nullable `Organization.lat` / `Organization.lng`, matching the current Prisma schema.
- Public shop API no longer loads `Organization` through relation includes that select all columns.
- `GET /api/public/organizations/[slug]/shop` explicitly selects public organization fields and excludes `lat` / `lng` until all runtime paths are migrated/verified.
- Payment settings are loaded independently with explicit selected fields.

## Minimal required validation gate

For stabilization phases, use the minimum required gate unless a phase explicitly changes lint-sensitive formatting or E2E behavior:

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Do not commit or ship

```txt
.env
prisma/dev.db
test-results/
.next/
node_modules/
public/uploads/
uploads/
```

Review `public/myResume.pdf` and remove it from release artifacts unless intentionally public.

## Recommended next phase

```txt
P23 — API Error/Guard Normalization
```

Keep it narrow: normalize private route guards and unknown-error responses without broad feature expansion.


## P24 — Tenant Identity Audit and Guardrails

P24 added a tenant identity validator and fixed two high-risk slug/id confusion paths:

- driver order acceptance now resolves organization slug to organization id before checking `Follow.customerId_organizationId`;
- notification settings lookup now resolves appointment `organizationId` to slug before reading slug-keyed `OrganizationSettings`.

New command:

```bash
pnpm run quality:tenant-identity
```

This validator is included in `quality:local`.


## Phase 25 update — commerce correctness guardrails

P25 adds a commerce correctness validator and transaction-scoped uniqueness retries for order numbers and public tracking tokens. Aggregate `quality:local` now runs the P25 validator.

Recommended next phase: P26 — appointment correctness guardrails.

## P26 — Appointment Correctness Guardrails

Status: source-level guardrails added.

- Appointment create/reschedule paths now enforce configured business hours server-side.
- Provider-specific business hours are checked before organization-wide fallback hours.
- Appointment conflict detection now uses booking buffers through a shared guarded-window helper.
- `pnpm run quality:appointment-correctness` is available and is included in `quality:local`.

Required target validation for P26:

```powershell
pnpm run quality:appointment-correctness
pnpm run typecheck
pnpm run build
pnpm run quality:local
```


## P26A — Order organizationSlug DB compatibility

P26A adds a database compatibility migration and drift check for `Order.organizationSlug`. This was needed after the target database reported Prisma `P2022` during build/page-data collection because the physical `Order` table was missing the column required by the current Prisma schema.

## P26B — Order deletedAt DB compatibility

P26B adds a database compatibility migration and drift check for `Order.deletedAt`. This was needed after the target database reported Prisma `P2022` during build/page-data collection because the physical `Order` table was missing the nullable soft-delete column required by the current Prisma schema.

## P27 — i18n / RTL Completion Audit

P27 adds a greenable localization audit gate:

- `pnpm run quality:i18n-rtl` validates dictionary presence/parsing, supported locale config, and html `lang`/`dir` wiring.
- `quality:local` now includes the P27 validator.
- P27 reports non-blocking audit warnings for dictionary-key drift and hardcoded RTL-script UI text.
- Stale `ShopifyX` metadata in the locale layout was replaced with Bazar Baz copy.

Known localization debt remains:

- English and Arabic dictionaries are not yet key-complete against Persian.
- Multiple TS/TSX surfaces still contain hardcoded Persian/Arabic UI strings.

Recommended next phase: P28 — Follow/Fanpage Readiness Cleanup.


## P28 — Follow/Fanpage Readiness Cleanup

P28 prepares the existing follow foundation for later fanpage implementation.

- Public appointment organization layout now uses explicit safe selected fields and active/deleted filters.
- Organization metadata no longer server-self-fetches through `NEXT_PUBLIC_APP_URL`.
- Follow button is wired into public appointment and shop pages.
- Anonymous users now see a login-to-follow prompt instead of the follow button disappearing.
- Follow labels are dictionary-driven for FA/EN/AR.
- Follow revalidation now covers all configured locales instead of Persian-only paths.
- `pnpm run quality:fanpage-readiness` is available and included in `quality:local`.

Fanpage feed/posts are still not implemented. Recommended next phase: P29 — Fanpage Content Model Foundation.
