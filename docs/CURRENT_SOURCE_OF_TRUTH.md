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
