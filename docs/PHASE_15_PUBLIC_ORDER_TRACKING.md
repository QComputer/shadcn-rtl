# Phase 15 — Public Order Tracking Privacy

## Goal

Phase 15 hardens public order tracking so order details are not exposed by the order number alone. Public access now relies on one of the allowed access paths:

- the original guest browser session,
- the logged-in customer account that owns the order,
- an active organization member for the order's organization,
- or the generated `publicTrackingToken` passed as `?token=...`.

## Changes

- `Order.publicTrackingToken` is documented as the public tracking secret for shareable order links.
- Public order lookup now ignores soft-deleted orders.
- Public order lookup is rate-limited per client/order number.
- Public order responses continue to strip `publicTrackingToken` and the guest session ID.
- Guest checkout and registered checkout continue to redirect to the order page with the generated token when the API response includes it.
- Public payment mutation remains disabled.

## Migration

Phase 15 includes:

```text
prisma/migrations/20260521030000_phase15_public_order_tracking/migration.sql
```

The migration adds `Order.publicTrackingToken` for deployments that do not already have it.

Run:

```powershell
npx prisma migrate deploy
```

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase15
```

The test checks:

- homepage reachable,
- health endpoint reachable,
- public search still responds,
- unknown public order does not leak,
- fake tracking token does not leak unknown order,
- public payment PUT remains disabled,
- authenticated-only orders API remains blocked.
