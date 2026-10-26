# Retail R4A promotion and payment integration contract

This document records the contract between the committed R3 merchant catalog and the R4 checkout/payment implementation. It does not change the R3 catalog contract or add a second order or payment engine.

## Baseline and ownership

- Accepted R2: `5a5bc6e2fa452c97534c7fa671c8cf936389b9a2`.
- R3 merchant catalog baseline: `c283e461af2cbb7e05f9e1b9efcd839762a0eaec`.
- R4 implementation lineage reviewed for this integration: `f1039c08c529f0d0ed9450809400bd286432a27e`, with follow-up test, route, and acceptance commits through `a51e8ddd18fe1b82d828d59fe078a182a34f23f0`.
- R3 owns catalog/category/attribute/media surfaces. R4 owns retail checkout, promotions, payment configuration and reports. The accepted R3 rule remains authoritative for merchant identity: selected organization comes from the authenticated session, active membership, role, SHOP capability and same-origin checks; never accept an organization ID from the management form as authorization.
- R3 does not implement checkout or payment. Its storefront may integrate the R4 contracts below without replacing the catalog, product or variant persistence.

## Existing storage reused

R4 uses tenant-scoped `Coupon` and `CouponRedemption` for retail codes. It leaves the older `Promotion` model untouched. Checkout re-reads product/variant prices, cart contents, delivery charge, tenant capability, payment policy and coupon eligibility on the server, then writes the order, price/discount snapshot, inventory changes, redemption, pending payment/event and idempotency result in the existing transaction boundary. Client totals are not authoritative.

Payment remains in the existing `Order`, `Payment`, `PaymentEvent`, `PaymentRequest`, `UssdPaymentIntent` and verification lifecycle. `RetailPaymentReport` records bank evidence, merchant review and cash collection; it is not a separate ledger. Payment status and fulfillment status remain independent.

## Merchant endpoints

All `/api/dashboard/retail/*` mutations use the authenticated selected organization, active membership and merchant role/capability checks in the server context, and enforce same-origin mutation protection.

| Method and path | Purpose |
|---|---|
| `GET /api/dashboard/retail/discounts` | List this organization's non-segmented retail coupons. |
| `POST /api/dashboard/retail/discounts` | Create a percentage or fixed code. Input includes `code`, `name`, `discountType`, `discountValue` and optional minimum, cap, start/end, total/per-customer limits and active flag. |
| `PATCH /api/dashboard/retail/discounts/{id}` | Update an owned code or its active state; used codes cannot have their material terms rewritten. |
| `GET /api/dashboard/retail/payment-settings` | Read this organization's retail payment policy. |
| `PUT /api/dashboard/retail/payment-settings` | Configure bank transfer, cash and iNoti switches; card/account display details; cash modes (`COUNTER`, `PICKUP`, `COURIER`) and before/after-placement policy. Invalid combinations are rejected. |
| `GET /api/dashboard/retail/payment-reports` | List tenant-owned bank/cash reports with order amount, evidence kind, review state and audit context. |
| `PATCH /api/dashboard/retail/payment-reports/{id}` | Approve, reject or request correction with a required reason for non-approval actions. |
| `GET /api/dashboard/retail/payment-reports/{id}/receipt` | Authorized, tenant-scoped private receipt retrieval; access is audited and response is private/no-store. |
| `POST /api/dashboard/retail/orders/{orderNumber}/cash-collection` | Confirm counter/pickup collection as an authorized merchant; order lock and serializable transaction prevent duplicate settlement. |

Merchant pages are `/[locale]/dashboard/retail-discounts`, `/[locale]/dashboard/retail-payment-settings`, and `/[locale]/dashboard/retail-payment-reports`.

## Storefront checkout endpoints

| Method and path | Contract |
|---|---|
| `GET /api/retail/v1/payment-methods?organization={slug}` | Returns only configured, currently eligible methods. Bank transfer requires valid card/account details; cash returns configured modes; iNoti is omitted unless tenant readiness and rollout gates pass. Responses are `no-store`. |
| `POST /api/retail/v1/checkout` | Authenticated, same-origin JSON request. Validated fields: `organization`, UUID `idempotencyKey`, order `type`, optional delivery address, optional `couponCode`, `paymentMethod` (`BANK_TRANSFER`, `CASH`, `INOTI_USSD`), and cash mode when applicable. The server computes all money and inventory effects. A successful response is `201` with order number, authoritative total string, order/payment status and method; bank details or the existing public tracking token are returned only for the matching method. |
| `POST /api/retail/v1/orders/{orderNumber}/bank-report?organization={slug}` | Authenticated customer, same-origin. Submit exactly one evidence mode: JSON `{method:"TIME", reportedAt, submittedLocalTime}` OR multipart `{method:"RECEIPT", receipt}`. Mixing/extra form fields are rejected. Receipt is size/type-checked and stored privately. A claim is not proof of settlement. |
| `POST /api/retail/v1/orders/{orderNumber}/courier-cash?organization={slug}` | Assigned, active tenant driver reports collection; report remains pending merchant reconciliation. |

The checkout payload carries the UUID idempotency key in JSON (not the HTTP `Idempotency-Key` header in this version). R3's product/catalog APIs do not own this key or checkout transaction. R3 should pass the selected store context as ordinary checkout input but must not use it as merchant authorization; customer ownership and server-side tenant/product/cart checks remain enforced by R4.

## Financial and operational invariants

- Percentage discounts are bounded by 100; fixed discounts and caps are applied to the authoritative subtotal, and a negative payable amount is rejected. Tenant/code uniqueness, active dates, minimums, usage limits and per-customer limits are checked server-side; coupon row locking and transaction isolation guard concurrent redemption.
- Orders are created unpaid. Selecting bank transfer or cash does not mark payment complete. Bank transfer permits one evidence mode; review records reviewer, time, decision and reason. Rejection/correction does not cancel the order. Only authorized approval settles the bank payment.
- Cash mode must match pickup/delivery eligibility. Merchant-confirmed counter/pickup and assigned courier reports use distinct flows; courier claims remain pending merchant reconciliation. Duplicate collection/settlement is prevented by order locking and state checks.
- iNoti uses the tenant's existing configured integration and verification lifecycle. R4 does not substitute platform credentials. Toman-to-Rial conversion remains at the provider boundary, and callbacks alone do not settle payment. No live provider call was part of acceptance.
- Receipt objects are private and tenant-scoped. Do not expose storage keys or public receipt URLs to the R3 storefront.
- Existing restaurant checkout/order flows and historical records retain their pre-R4 behavior; the R4 key and report records are retail-specific.

## Retail R3 integration sequence

1. Continue using R3 catalog/category/product/variant contracts unchanged for browsing and merchant catalog management.
2. At checkout, send the selected organization slug, a fresh UUID idempotency key, order type, optional delivery address/coupon code, payment method, and cash mode only when cash is selected.
3. Obtain method choices from `/api/retail/v1/payment-methods`; do not infer iNoti availability from a merchant toggle alone.
4. On bank transfer, show returned merchant details and offer two mutually exclusive report UIs (receipt upload or claimed date/time). Clearly label either as customer-submitted evidence pending merchant review.
5. Render checkout order/payment states independently from fulfillment status. Do not show availability, settlement or payment confirmation based on client form submission.
6. Merchant promotion/payment pages remain R4-owned. Do not duplicate them in the R3 catalog screens.

## Acceptance evidence and limitations

The reviewed hosted R4 acceptance record is `docs/retail/RETAIL-R4-ACCEPTANCE.md`; run `38517082127` completed successfully at `f1039c08c529f0d0ed9450809400bd286432a27e`, including PostgreSQL 17, 85 focused regressions, 1 R4 PostgreSQL integration test, static/build gates and authenticated browser acceptance. Later branch commits add route/test fixes and record the acceptance through `a51e8ddd18fe1b82d828d59fe078a182a34f23f0`.

This contract is for local/isolated retail integration only. It is not authorization to enable live payment methods, call iNoti, deploy, or treat customer evidence as verified funds. Before production activation, require tenant-owned credential provisioning and the separately approved operational gates described in the acceptance record.
