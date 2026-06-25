# Phase 34 — Source-of-Truth Documentation Sync

Date: 2026-06-25

## Goal

Bring the project handoff documentation back in line with the current source tree after P30 fanpage MVP, P31 dictionary completion, P32 database migration overlay, and P33 release artifact cleanup.

## Scope

Docs-only. No runtime code, schema, route, package, or validator behavior was changed.

## Updated files

- `README.md`
- `docs/CURRENT_SOURCE_OF_TRUTH.md`
- `docs/ROUTE_API_DB_SERVICE_INVENTORY.md`
- `docs/FOLLOW_FANPAGE_ROADMAP.md`
- `docs/SEED_TESTING_GUIDE.md`
- `docs/PHASE_34_SOURCE_OF_TRUTH_SYNC.md`
- `docs/PHASE_34_OVERLAY_MANIFEST.md`

## Key corrections

- README now lists current P20-P34 state instead of ending with older roadmap claims.
- Current source-of-truth now includes P30/P31/P32/P33/P34 and names the next recommended phase.
- Route/API inventory was regenerated from the current `app` tree and includes shop fanpage, appointment fanpage, fanpage posts API, driver location API, and order assignment API.
- Fanpage roadmap now reflects the implemented `FanpagePost` model instead of stale planned `FollowPost` models.
- Seed guide now points to the active `prisma/seed.ts` and `pnpm run db:seed`, documents the effective seed password `123456`, and records known seed cleanup debt.

## Validation

Docs-only validation target:

```powershell
pnpm run quality:local
pnpm run release:stage
pnpm run quality:release-staged
```

Full target-machine gate remains:

```powershell
pnpm run db:validate
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Recommended next phase

```txt
P35 — seed/auth testing cleanup and dashboard members refresh fix
```

Keep P35 narrow and code-focused:

1. Fix `prisma/seed.ts` console/password mismatch.
2. Add/verify a lightweight seed-auth smoke check if practical.
3. Fix the suspicious dashboard members refresh path that references `/api/organizations/noId/members`.
4. Validate with typecheck, build, and `quality:local`.
