# Phase 5 — Order/payment production hardening

## Goal

Phase 5 improves order and payment correctness by replacing the weak Boolean order payment state with a real payment enum and by adding append-only history records for order status and payment status changes.

## Changes

### Prisma schema

- `Order.paymentStatus` is now `PaymentStatus @default(PENDING)` instead of `Boolean`.
- Added `PaymentEvent` for append-only payment status history.
- Added `OrderStatusHistory` for append-only order status history.
- Added migration `20260520230000_phase5_order_payment_hardening`.

The migration converts existing Boolean values as follows:

| Old Boolean | New enum |
| --- | --- |
| `true` | `COMPLETED` |
| `false` | `PENDING` |

### Order service

- Order creation now records an initial `OrderStatusHistory` row.
- Order creation now records an initial `PaymentEvent` row.
- Order status updates now record `OrderStatusHistory` rows.
- Payment status updates now go through `orderService.updatePaymentStatus()` and record `PaymentEvent` rows.
- Driver order listing no longer mutates the same filter object for assigned and unassigned order queries.

### Payment API

`PUT /api/orders/[id]/payment` now accepts:

```json
{
  "status": "PENDING | COMPLETED | FAILED | REFUNDED",
  "paymentId": "optional transaction/reference id",
  "note": "optional operator note"
}
```

The route requires authenticated organization access and is no longer a raw Boolean update.

### Dashboard/public UI

- Dashboard order payment controls now use payment enum states.
- Public order page displays enum payment labels.
- Public order payment mutation remains disabled.

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://your-domain.example"; npm run e2e:deployed:phase5
```

Linux/macOS/Git Bash:

```bash
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase5
```

The test checks:

- Homepage is reachable.
- Public search responds.
- Unauthenticated order detail is blocked.
- Unauthenticated order status mutation is blocked.
- Unauthenticated payment status mutation is blocked.
- Public order payment PUT remains disabled.
- Unknown public order lookup does not leak data.

## Manual checks after deployment

1. Create a guest order.
2. Create a registered-user order.
3. Open dashboard orders as an authorized admin/manager.
4. Mark payment as completed.
5. Confirm `Order.paymentStatus = COMPLETED`.
6. Confirm `Payment` is upserted for the order.
7. Confirm `PaymentEvent` has a row for the change.
8. Change order status and confirm `OrderStatusHistory` is appended.

## Remaining follow-ups

- Add signed payment gateway webhooks.
- Add idempotency keys for payment callbacks.
- Add `publicTrackingToken` for public order tracking.
- Add `InventoryMovement` for inventory auditability.
- Add authenticated deployed smoke tests with seeded credentials.
