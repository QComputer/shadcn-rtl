# P42 — Customer Club Foundation

Date: 2026-06-25

## Scope

P42 adds the organization-scoped Customer Club foundation from the growth roadmap.

This intentionally differs from the prior repo recommendation of “dashboard server/API guard parity review.” The user-provided handoff named `BAZAR_BAZ_GROWTH_ROADMAP.md` as canonical and instructed P42 to start with Customer Club, so this phase follows that roadmap and leaves guard-parity review as a later stabilization pass.

## Runtime Changes

- Added `CustomerClubMembership` with organization/customer uniqueness.
- Added membership status, tier, and join-source enums.
- Added an idempotent Prisma migration for the new table, indexes, enums, and foreign keys.
- Added `customerClubService` for listing, joining/reactivating, updating, and leaving memberships.
- Added audit logging for create/reactivate and update/leave operations.
- Added self-service membership API:
  - `GET /api/customer-club/membership?organizationId=...`
  - `POST /api/customer-club/membership`
  - `PATCH /api/customer-club/membership`
  - `DELETE /api/customer-club/membership?organizationId=...`
- Added management API:
  - `GET /api/dashboard/customer-club/members?organizationId=...`
- Added dashboard pages:
  - `/{locale}/dashboard/customer-club`
  - `/{locale}/dashboard/customer-club/members`

## Access Model

- Customer Club data is always scoped by `organizationId`.
- A user can read, join, and leave their own membership.
- Managing another customer or changing tier/status requires active organization `ADMIN` or `MANAGER` access.
- `SUPER_ADMIN` keeps full access through existing API guard behavior.
- `STAFF` and `DRIVER` do not see Customer Club management navigation.
- This phase does not mutate global `User.role`.

## Dashboard UI

The dashboard members page includes:

- localized FA/EN/AR copy;
- loading, error, and empty states;
- count cards;
- search;
- compact table layout;
- detail dialog for status/tier updates;
- shadcn/Radix-compatible Card, Dialog, Badge, Button, Input, and Select composition.

## Deferred

- Consent and communication preferences.
- Tags and segmentation.
- Imports beyond single membership creation/reactivation.
- Campaigns and notifications.
- Public shop join button placement.
- Customer lifetime value and financial analytics.

## Validation

Focused validator:

```powershell
pnpm run quality:customer-club-foundation
```

Recommended P42 gate:

```powershell
pnpm run db:validate
pnpm run db:generate
pnpm run quality:customer-club-foundation
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```
