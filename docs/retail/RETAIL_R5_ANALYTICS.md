# BB-RETAIL-R5 — Retail reporting

## Targeted reuse

| Capability | Existing/reusable | R5 gap/action |
|---|---|---|
| Merchant dashboard | Dashboard shell, navigation and SHOP capability, ADMIN/MANAGER tenant context | Add analytics route; use both existing route registries |
| Financial truth | Order + unique Payment; cash/report confirmation; paidAt | Read-only SQL aggregates, no payment/event double counting |
| Purchase history | Immutable OrderItem name, SKU, options, unit price and discount | Group historical identities/snapshots; retain archived products |
| Inventory | Product tracking/threshold, variant inventory/reservations/backorders, InventoryMovement | Current counts, bounded alerts and movement history |
| Exports | R3 CSV/XLSX writer, BOM, formula shielding, string cells | Optional explicit report columns; existing catalog behavior unchanged |
| Generic dashboard statistics | Not equivalent to Retail collections or snapshot performance | Shared Retail service, no warehouse or new persistence |
| Refund accounting / historical brand/category | No authoritative refund amount ledger or brand/category snapshot | Unavailable; no inferred net revenue or historical taxonomy |

## Definitions and boundaries

All queries require the active authorized Organization and SHOP capability. The report
service additionally validates context ID/slug and ADMIN/MANAGER/SUPER_ADMIN role.
Anonymous/customer/STAFF cannot read or export reports. No customer PII is returned.

Only non-soft-deleted Retail orders carrying `retailCheckoutKey` are included. Legacy
orders without this marker are excluded explicitly, rather than mixed with restaurant
transactions. Time ranges are bounded to 366 inclusive calendar days. Organization's
IANA timezone determines boundaries and daily buckets through PostgreSQL `AT TIME ZONE`;
no fixed UTC offset. Date inputs and current-month preset are explicitly Gregorian;
Persian display dates use the established Intl Persian calendar.

* Created orders / gross value: count / sum of stored Order.total by creation date,
  including canceled and refunded-status orders. This measures registered value, not revenue.
* Verified collections: sum unique Payment.amount by Order.paidAt in range, only when
  both payment statuses are COMPLETED and amount equals stored Order.total. Cash also
  requires an approved CASH_COLLECTION report with reviewer and review timestamp.
  PaymentEvents and attempts are not summed. Collected canceled orders remain receipts;
  no assumption of a refund is made. Missing paidAt is excluded from receipt time series.
* Pending amount: sum stored total of creation-period PENDING-payment orders excluding
  CANCELLED/REFUNDED. FAILED payments are not asserted as collectible debt.
* Average order value: created-order total / created-order count. Shipping, tax and discount
  display stored Order values; they are never re-added to stored total. Current checkout
  total uses subtotal + delivery fee - order discount; historical tax is shown as recorded.
* Product performance: paid, noncanceled/nonrefunded creation-period items, grouped by
  product ID, variant ID and immutable snapshot facts. Value = unit purchase price ×
  quantity - item discount. No allocation of whole-order discount, tax or shipping.
  Ranking supports quantity or item value. Null historical snapshots are explicitly labeled.
* Returning customers: distinct account IDs with an earlier verified noncanceled purchase
  in the same tenant. New/returning partition current purchasing accounts. Rate =
  returning accounts / current purchasing accounts; guests and similar phones are not merged.
* Stock is current, independent of order date/status. Available = inventory - reservedQuantity.
  Existing per-product lowStockThreshold is default; query override changes no settings.
  Untracked items are never called sold out. Zero available + backorder is not out of stock.
  Missing priced variants is a completeness issue, not physical stock evidence.

Order/payment/product/category filters are server validated and shared by aggregates.
Product/category selection selects whole matching orders for order/receipt KPI values;
item performance selects matching items. Category membership is CURRENT, not historical.
Inventory accepts product/category/threshold scope only; movement history additionally uses dates.

## Query and export limits

One repeatable-read, read-only transaction, 15-second statement timeout, 25-second
transaction timeout; route maxDuration 60 seconds. Bounded aggregate SQL instead of
loading orders or current prices into memory. Existing indexes cover tenant, order date,
item order/product/variant, payment orderId and inventory variant/date. No schema change.
Product page size 20, stock alerts 25, stock movements 20. Exports explicitly cover the
same displayed product page or current alert subset, not an unbounded entire catalog.
They preserve exact decimal strings and identifiers, filter metadata and local date range.
CSV has BOM/quoted cells/formula protection; XLSX strings do not become executable formulas.

This DEMO build shows a visible context warning. It does not claim DEMO orders represent
real merchant performance. No real payment activation, stock adjustment, order mutation,
shared-DEMO migration or Production release is part of R5 Preview acceptance.
