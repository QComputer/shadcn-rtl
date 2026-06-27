# P46 - Loyalty Points and Coupons

Date: 2026-06-26

## Summary

P46 adds the first Customer Club retention-money layer:

- organization-scoped loyalty point ledger rows;
- purchase earning rules;
- organization-scoped coupons;
- coupon redemption records;
- dashboard pages for `/dashboard/customer-club/loyalty` and `/dashboard/customer-club/coupons`;
- focused source validator `quality:loyalty-coupons`.

## Data model

Added Prisma enums:

- `LoyaltyLedgerType`
- `CouponDiscountType`

Added Prisma models:

- `LoyaltyLedger`
- `LoyaltyRule`
- `Coupon`
- `CouponRedemption`

All new records are scoped by `organizationId`.

## Loyalty behavior

- Loyalty balances are derived from `LoyaltyLedger` rows.
- Ledger rows are append-only in the service layer.
- Purchase awards are idempotent per `organizationId`, `orderId`, and `type`.
- Purchase awards require:
  - the order to belong to the current organization;
  - a registered customer order;
  - an active Customer Club membership;
  - a non-canceled/non-refunded order;
  - an active purchase rule.
- Manual adjustments also create ledger rows instead of mutating balances.

## Coupon behavior

- Coupon codes are normalized before storage.
- Coupons are organization-scoped by unique `(organizationId, code)`.
- Redemption enforces:
  - active date windows;
  - total usage limit;
  - per-customer usage limit;
  - order organization/customer match when an order is supplied;
  - optional Customer Segment membership.

## Routes and APIs

Dashboard pages:

```txt
/{locale}/dashboard/customer-club/loyalty
/{locale}/dashboard/customer-club/coupons
```

Dashboard APIs:

```txt
GET  /api/dashboard/customer-club/loyalty
POST /api/dashboard/customer-club/loyalty
GET  /api/dashboard/customer-club/coupons
POST /api/dashboard/customer-club/coupons
```

Both API surfaces require signed-in organization `ADMIN`/`MANAGER` access, with existing `SUPER_ADMIN` behavior inherited through the shared guards.

## Validation

```powershell
pnpm run db:validate
pnpm run db:generate
pnpm run quality:loyalty-coupons
pnpm run quality:campaign-builder
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

## Deferred

- Public checkout coupon redemption UI.
- Automatic order-completed loyalty award hooks.
- Loyalty point redemption at checkout.
- Coupon analytics and attribution beyond redemption records.
- Owner-configurable rule editing/deactivation UI.
