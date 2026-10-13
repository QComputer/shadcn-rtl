# Retail R4 checkout and payment acceptance

## Scope and isolation

- Accepted R3 parent: `c283e461af2cbb7e05f9e1b9efcd839762a0eaec`.
- Branch: `codex/retail-r4-checkout-20261013`.
- Worktree: `C:\Users\disso\.codex\worktrees\retail-r4-checkout-20261013\shadcn-rtl`.
- All database acceptance uses the GitHub Actions PostgreSQL 17 service at loopback port `55433`, database `bazarbaaz_retail_r4`. The fixture and integration suite check the URL, current database, server major version, and explicit environment guards before writes.
- The receipt acceptance adapter writes only to a disposable runner directory with private file permissions. The production path requires a private Vercel Blob write and has no public-access fallback.
- No Production or Neon data, customer payments, live iNoti calls, or active Hotel/PWA/R2/R3 worktrees are used. The R4 Git branch's Vercel ignored-build rule suppresses preview deployment.

## Reused contracts and schema changes

The implementation retains `ShopCart`, `Order`, `OrderItem`, `Payment`, `PaymentEvent`, `InventoryMovement`, `Coupon`, `CouponRedemption`, tenant `PaymentSettings`, and iNoti `PaymentRequest`/`UssdPaymentIntent`/provider verification. Product and variant price, stock, eligibility, and the tenant capability are reread by the checkout server. A serializable transaction decrements tracked inventory conditionally, snapshots item prices and totals, records coupon redemption and the pending payment, clears the cart, and binds an idempotency key to the order. The server never accepts a client total.

Two backward-compatible migrations were added:

1. `20261013130000_retail_checkout_idempotency`: nullable unique order checkout key.
2. `20261013140000_retail_payment_reports`: tenant-owned bank/cash evidence and review records with a partial unique index for one pending report per order.

Restaurant records have null R4 checkout keys. Legacy restaurant order and payment routes retain their existing semantics. Retail orders reject the legacy manual payment completion path.

## Financial states

| Action | Order fulfillment | Payment obligation | Evidence/reconciliation |
| --- | --- | --- | --- |
| Checkout | `PENDING` | `PENDING` | Authoritative price, coupon, delivery, and stock snapshots |
| Bank receipt or time submitted | unchanged | `PENDING` | Exactly one report kind; `PENDING_REVIEW` |
| Bank report rejected/correction requested | unchanged | `PENDING` | Reason, reviewer, and review time retained |
| Bank report approved | unchanged | `COMPLETED` | Merchant review and payment event recorded |
| Cash selected | `PENDING` | `PENDING` | Collection mode snapshotted; selection is not payment |
| Counter/pickup cash confirmed | unchanged | `COMPLETED` | Authorized merchant confirms collection |
| Courier reports collection | unchanged | `PENDING` | Merchant reconciliation required |
| Verified iNoti callback | unchanged | `COMPLETED` only after provider verification | Existing durable correlation and payment event |
| Cancelled unpaid retail order | `CANCELLED` | remains unsettled | Inventory restored; active PaymentRequests cancelled |
| Late verified iNoti payment after cancellation | remains `CANCELLED` | not auto-settled | Provider verification retained for reconciliation |

Paid retail orders require a separate refund review before cancellation. Expired or cancelled iNoti PaymentRequests retain the existing reconciliation path; they are never automatically settled by a late callback.

## R4 phases

- **R4A, discounts and checkout:** Existing tenant coupons support percentage/fixed discounts, dates, minimums, caps, global/per-customer limits, and redemption history. Merchant forms use the authenticated organization context. Checkout applies the coupon under a row lock in its serializable transaction. Integration coverage includes variant price and stock, tenant isolation, idempotency, and a two-buyer concurrency race.
- **R4B, bank and cash:** Store settings are tenant-scoped. Bank reporting accepts exactly one of a private image receipt or a normalized timestamp with the submitted local context. Merchant review, rejection/correction, receipt access audit, cash counter/pickup confirmation, and courier reconciliation use R4 report and payment events. The customer checkout stays pending until authorized confirmation.
- **R4C, iNoti:** The customer method requires merchant policy, active/connected tenant integration, a tenant-owned non-platform credential profile, configured dial string, provider readiness, and the independent live-payment rollout gates. The existing iNoti workflow creates the PaymentRequest and performs callback correlation, Toman-to-Rial conversion, durable provider verification, and settlement. The R4 acceptance runner keeps live gates off and tests provider behavior with fixtures. A merchant without a verified integration is not offered USSD.

## Verification record

Hosted CI run [38468990694](https://github.com/QComputer/shadcn-rtl/actions/runs/38468990694) passed 97 migrations, synthetic fixture seed/verification, 83 focused tests, one R4 PostgreSQL integration test, ESLint, TypeScript, and an optimized production build on the then-current branch. Browser acceptance failed at the storefront full-load wait after successful login; that failure is not a pass. The follow-up branch run must pass the complete browser path before R4 can be accepted.

The browser suite exercises authenticated customer checkout, receipt-only/time-only submissions, merchant review, unauthorized and cross-tenant rejection, and captures mobile storefront and dashboard screenshots. Test assets, prices, stock, accounts, and bank details are synthetic and explicitly marked. Provider calls remain zero.

## Remaining gate

Update this record with the final SHA, complete CI run, screenshot artifact, and any unresolved browser or financial failures. Until every required check passes, the delivery verdict remains `RETAIL_R4_BLOCKED`.
