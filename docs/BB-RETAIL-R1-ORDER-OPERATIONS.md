# BB-RETAIL-R1 — Retail order operations

Baseline: `9e5b3d73bc6a5994fcfd185ec8f2cfbfd2a295f4`.

## Capability matrix

| Capability | Existing source | R1 treatment |
|---|---|---|
| Order persistence, checkout snapshots, inventory ledger | Order / OrderItem / InventoryMovement; Retail checkout | Reused without schema changes |
| Status transactions, history, cancellation release | OrderService.updateStatus; restoreRetailInventoryTx | Reused; type-aware Retail graph and locked expected-status guard added |
| Cash collection and payment reconciliation | Retail cash / payment-report services | Reused; payment remains independent of fulfillment |
| Merchant order screen | Generic restaurant/Retail dashboard | Dedicated Retail operations view and bounded tenant queries added; existing screen retained |
| Refund/return accounting | No verified Retail refund-completion contract | Out of scope: no return/refund state invented; paid cancellation/refund completion remains rejected |
| Carrier tracking, automated refunds, bulk actions | No R1 contract | Out of scope |

## Workflow

`PENDING/PLACED → ACCEPTED → PREPARING → READY → PICKED_UP`.
For pickup, PICKED_UP means collected and is terminal. For delivery, it means dispatched; `PICKED_UP → DELIVERED` records final delivery.
No status migration. Retail orders cannot skip preparation/dispatch or cancel after handover. Unpaid cancellation is available before handover; existing payment-before-acceptance guards still apply. Paid cancellation and Retail REFUNDED require a separate verified financial workflow and remain blocked.

The shared OrderService validates the Retail graph under the existing row lock, including callers from the older order screen. The new adapter also checks organization, nondeleted Retail identity and expected source status inside that lock. Same-status retries do not add history, notifications or stock movements. ADMIN/MANAGER use existing active membership and SHOP capability checks; ordinary members/customers are denied. No new STAFF privilege is granted.

## Merchant UI / API

- `/fa/dashboard/retail-orders`: responsive order cards, action highlights, all status counts, search, operational/payment/date filters, stable sorting, bounded pagination, detail dialog and explicit confirmations.
- `GET /api/dashboard/retail/orders`: page size max 50, tenant-scoped count/group queries; no full-table projection.
- `GET/POST /api/dashboard/retail/orders/[orderNumber]`: safe explicit projection; same-origin mutation; stale status conflict 409.
- Existing cash-collection API remains authoritative; no generic paid/refunded action.
- Names, SKU, attributes and prices use purchased snapshots. Missing historical snapshots are labeled as missing, never replaced with today's catalog facts.
- Images are current, tenant-owned PUBLIC media for that same product/variant and are labeled accordingly. This schema has no immutable image snapshot; no historical image claim is made.
- Pre-Retail checkout orders remain readable here, without mutation actions; the older dashboard remains available for their existing workflow.
- Customer-bearing GET responses explicitly use `Cache-Control: private, no-store`.

## Verification

Local evidence: `C:/Users/disso/.codex/artifacts/retail-r1-20261022/` (not committed).

- 8 focused unit tests passed (workflow, payment separation, dashboard route policy and snapshot presentation).
- R1 PostgreSQL contract and existing P1.3 order/financial contract passed on guarded PostgreSQL 16, loopback port 54713, database retail_p0_20261019. The R1 test observes an actual blocked row-lock request before releasing a conflicting update.
- Existing Retail P0 PostgreSQL catalog/cart/checkout regression passed, including snapshots and inventory concurrency.
- TypeScript and scoped ESLint passed; full optimized Next production build passed locally. The final commit's complete Vercel Preview build remains a release gate.
- Installed Chrome desktop 1365×900 and mobile 390×844: normal credential login; ADMIN/MANAGER allowed, customer/anonymous denied; list, immutable details, acceptance/preparation, history, cancellation confirmation, reachable mobile controls and no overflow. Own fixture cleanup passed.
- Hosted Preview acceptance is read-only. No shared orders, stock, payment policies or credentials are changed by R1 testing.

No migrations, live payments, SMS/recovery work, storefront/checkout redesign or Production deployment are part of R1.
