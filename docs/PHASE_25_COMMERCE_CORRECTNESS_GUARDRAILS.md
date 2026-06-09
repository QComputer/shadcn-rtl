# Phase 25 — Commerce Correctness Guardrails

Date: 2026-06-09

## Goal

P25 adds lightweight commerce correctness guardrails without rewriting the checkout, payment, or inventory workflows.

The phase focuses on preventing regressions in the most sensitive commerce paths:

- delivery fee source of truth
- order number and public tracking token uniqueness
- transactional checkout
- stock decrement and inventory movement records
- payment event auditability
- public order tracking privacy
- disabled public payment mutation
- authenticated dashboard-only payment mutation

## Source changes

### `lib/services/order.service.ts`

- Replaced one-shot random order number creation with transaction-scoped retry helpers:
  - `generateUniqueOrderNumber(tx)`
  - `generateUniquePublicTrackingToken(tx)`
- Removed `Math.random()` from order number generation.
- Generated `orderNumber` and `publicTrackingToken` inside the checkout transaction for both registered and guest checkout.
- Preserved existing transactional inventory decrement, inventory movement, status history, and payment event behavior.

### `scripts/quality/validate-commerce-correctness.mjs`

New validator checks that:

- order/cart delivery fee uses `OrganizationSettings.deliveryFee`
- order numbers avoid `Math.random()`
- public tracking tokens have uniqueness retry
- registered and guest checkout run inside Prisma transactions
- checkout decrements inventory and records `ORDER_CREATED` movement
- order creation records payment events
- cancel/refund restore guard exists
- public order tracking strips `publicTrackingToken` from response
- public order payment mutation remains disabled
- authenticated payment mutation requires admin/manager order access
- insufficient inventory maps to HTTP `409`

### `scripts/quality/validate-project.mjs`

- Includes the P25 validator in aggregate `quality:local`.

### `package.json`

- Added `quality:commerce-correctness`.

## Validation

Required target validation:

```bash
pnpm run quality:commerce-correctness
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Remaining follow-up

P25 does not add true idempotency keys, payment gateway webhook verification, or checkout concurrency E2E tests. Those should be handled in later payment/provider and release-candidate phases.
