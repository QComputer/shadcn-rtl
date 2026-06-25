# P44 - Customer Segments MVP

Date: 2026-06-25

## Scope

P44 adds organization-scoped customer segments for Customer Club members so future campaigns can target reusable groups without recomputing business rules ad hoc.

This phase does not create campaigns and does not send SMS, email, Telegram, Web Push, or other external notifications.

## Runtime Changes

- Added Prisma models:
  - `CustomerSegment`
  - `CustomerSegmentRule`
  - `CustomerSegmentSnapshot`
- Added the initial ready segment definitions:
  - `all_club_members`
  - `new_members_30d`
  - `recent_buyers_30d`
  - `inactive_60d`
  - `vip_by_revenue`
  - `high_order_count`
  - `abandoned_cart_candidates`
- Added `customer-segments.service.ts` to compute counts from:
  - active `CustomerClubMembership` rows by `organizationId`;
  - non-cancelled orders by `organizationSlug`;
  - active or abandoned carts by `organizationSlug`.
- Added dashboard API:
  - `GET /api/dashboard/customer-club/segments?organizationId=...`
  - `POST /api/dashboard/customer-club/segments?organizationId=...`
- Added dashboard page:
  - `/{locale}/dashboard/customer-club/segments`
- Linked Customer Club members to the segment view.

## Access Model

- Segment APIs require a signed-in session.
- Segment APIs resolve the current organization through the existing organization guard.
- Segment APIs require organization `ADMIN`/`MANAGER` access, with existing `SUPER_ADMIN` behavior inherited through guards.
- The dashboard route is listed in both route registries.
- Segment counts are calculated only from the requested organization's Customer Club, order, and cart data.

## Snapshot Behavior

- `GET` is read-only and calculates current counts.
- `POST` saves or updates reusable segment rows, replaces their rule rows, stores count snapshots, and writes an audit log.
- Snapshots are intentionally explicit so future campaign work can choose a saved segment state.

## Deferred

- Campaign drafts.
- Campaign scheduling.
- Segment membership materialization tables.
- Rich rule builder UI.
- External delivery providers.
- Analytics beyond snapshot counts.

## Validation

Focused validator:

```powershell
pnpm run quality:customer-segments
```

Recommended P44 gate:

```powershell
pnpm run db:validate
pnpm run db:generate
pnpm run quality:customer-segments
pnpm run quality:in-app-notifications
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
