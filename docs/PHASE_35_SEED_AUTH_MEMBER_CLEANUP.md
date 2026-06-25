# Phase 35 — Seed/Auth Testing Cleanup and Dashboard Member Refresh Fix

Date: 2026-06-25

## Goal

Make the seeded-auth guidance and dashboard member-management flow internally consistent before broader member-management UX work.

## Changes

### Seed credentials

- Added a single `DEMO_PASSWORD` constant in `prisma/seed.ts`.
- The seed now hashes `DEMO_PASSWORD` and prints the same value in the console footer.
- Removed stale `password123` references from active seed/testing guidance.
- Corrected the seed console summary to describe the current organization count: 8 organizations, 4 shop and 4 appointment.
- Corrected stale appointment demo usernames in the seed console footer.

Effective seeded password:

```txt
123456
```

### Dashboard members refresh

- Replaced the placeholder `/api/organizations/noId/members` refetch in `app/[locale]/dashboard/members/page.tsx`.
- The page now resolves the active organization through `/api/users/me/membership` and uses the real organization id for member loads and post-update refreshes.
- Member role/status changes now call `/api/organizations/[id]/members/[mId]` instead of attempting a global `/api/users/[id]` role update from the members page.
- Added a visible error block so fetch/update failures are not silently stored in state.

### Organization-member API

- Extended `app/api/organizations/[id]/members/[mId]/route.ts` so `PUT` can update organization member roles as well as active status.
- Role updates are limited to manageable organization member roles: `ADMIN`, `MANAGER`, `STAFF`, and `DRIVER`.
- The route keeps the existing organization access guard and writes audit logs for role and status changes.

### Quality guard

Added:

```txt
scripts/quality/validate-seed-auth-members-cleanup.mjs
```

Package script:

```powershell
pnpm run quality:seed-auth-members
```

`validate-project.mjs` now runs this focused guard as part of `quality:local`.

## Validation

Run after applying the overlay:

```powershell
pnpm run quality:seed-auth-members
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

## Manual smoke checks

After seeding a disposable database:

```powershell
pnpm run db:seed
pnpm run dev
```

Verify:

1. Login with `superadmin` / `123456`.
2. Login with `shop-admin` / `123456`.
3. Open `/fa/dashboard/members` as an org admin/manager.
4. Change a member active status and confirm the list refreshes without a `/noId/` request.
5. Change a member role and confirm the selected organization member updates without requiring a SUPER_ADMIN global role update.

## Known remaining debt

- The members page still has older UX and hardcoded Persian copy. P35 only fixes correctness and consistency.
- A future P36 should improve empty/loading/error/unauthorized states and review provider layering.
