# Phase 14 — Inventory operations and movement history

## Goal

Improve production inventory integrity by recording stock-changing operations in an append-only movement table and preventing repeated inventory restoration on cancelled/refunded orders.

## Scope

- Prisma schema and migration for `InventoryMovement`.
- Order checkout stock decrement movement records.
- Order cancellation/refund stock restoration movement records.
- Product variant initial stock and manual adjustment movement records.
- Deployed no-Playwright smoke coverage.
- README and quality validator updates.

## Data model

Phase 14 adds:

- `InventoryMovementReason`
  - `INITIAL_STOCK`
  - `MANUAL_ADJUSTMENT`
  - `ORDER_CREATED`
  - `ORDER_CANCELLED`
  - `ORDER_REFUNDED`
- `InventoryMovement`
  - variant id
  - optional order id
  - signed quantity delta
  - before/after stock snapshots when available
  - reason
  - note
  - actor id
  - creation timestamp

## Runtime behavior

### Checkout

When an order is created, inventory is decremented in the same transaction and a movement row is recorded for each tracked variant.

### Cancellation/refund

When an order moves to `CANCELLED` or `REFUNDED`, inventory is restored only if no previous restoration movement exists for the order. This prevents accidental double-restoration.

### Dashboard variant inventory edits

When a product variant inventory value changes from the dashboard, the old value, new value, and delta are recorded as a `MANUAL_ADJUSTMENT` movement.

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase14
```

The test verifies:

- homepage reachability;
- product listing still handles oversized pagination;
- product variant create/update are blocked without auth;
- order and payment mutations remain blocked without auth;
- health endpoint remains reachable.

## Notes

This phase does not yet add a dashboard UI for inventory movement history. It creates the production-safe audit data needed for a future inventory ledger/report page.


### Phase 14 build hotfix

Fixed the TypeScript type annotation for inventory restore movement reasons by using the generated Prisma `InventoryMovementReason` type alias instead of treating the runtime enum object as a namespace in type position.
