# BB-RETAIL-R2 — Fulfillment and delivery

Baseline: `270ea6085113bc4d003f6a650a0a6724b82986e7` (latest authorized main verified before branching).

## Targeted capability matrix

| Capability | Reusable source | Gap | R2 action |
|---|---|---|---|
| Tenant pickup/delivery and one fee | OrganizationSettings; existing organization settings route/page | Merchant page lacked controls | Embed a scoped form in the same page, using the same columns |
| Delivery instructions and pickup location | Organization address/phone; OrganizationSettings.settings JSON | No bounded Retail projection | Namespaced retailFulfillment JSON, preserve other settings, optimistic version and audit |
| Shipping quote and order amounts | checkout-quote.server.ts / checkout.server.ts | Review token did not include all fulfillment configuration | Include method flags and displayed instructions; preserve existing fee calculation and serializable placement |
| Fulfillment workflow and inventory | R1 OrderService / merchant-orders.server.ts | No dispatch detail fields | Optional bounded handover data in the same locked status transaction/history |
| Driver logistics | dashboard/driver-orders and assignment APIs | Driver-specific workflow | Preserve unchanged; Retail uses the existing R1 list with queue/type filters |
| Customer confirmation | Retail owner order API / PremiumOrderConfirmation | Missing type-aware history | Safe timeline and saved fulfillment instructions; customer-only authorization retained |
| Carrier APIs / free-shipping rules / automated refunds | Not established here | Out of scope | No invented providers, fees, thresholds or financial completion |

The source-of-truth and route/API inventory documents were read; their old synchronization dates were checked against actual code rather than assumed current.

## Contracts reused / extended

- `lib/retail/merchant-context.server.ts`: same membership and SHOP guards, optional explicit organization target for settings; ordinary users cannot select another active tenant.
- `GET/PATCH /api/dashboard/retail/fulfillment-settings`: narrow facade over existing OrganizationSettings, not a second store. Same-origin PATCH, strict input, conflict 409, private/no-store response. Null fee means unconfigured.
- `app/[locale]/dashboard/settings/organization/page.tsx`: embeds `RetailFulfillmentSettings`; no duplicate shipping-settings navigation.
- R1 list query adds optional `type` and `queue=fulfillment`; existing paging and tenant boundaries remain. Queue contains accepted/preparing/ready orders and dispatched delivery orders.
- R1 status POST adds optional `handover: {operatorName, trackingReference, merchantNote}` for PICKED_UP/DELIVERED only. The first two are explicitly customer-visible; merchantNote is internal.
- `lib/services/order.service.ts`: existing row lock, expected status, graph, retry/no-op, financial guards and stock-release code are reused. Versioned `retail-fulfillment` JSON is written to OrderStatusHistory.note atomically. Existing plaintext history is not rewritten/reinterpreted. Server history time and changedById identify the event and actor.
- `PICKED_UP + PICK_UP` means collected; `PICKED_UP + DELIVERY` means dispatched. READY labels are also type-specific. No enum changes or historical status rewriting.
- Existing `GET /api/retail/v1/orders/[orderNumber]?organization=` is still owner-only. The customer projection exposes event labels/times and actual supplied operator/reference only, never internal event notes or staff IDs.
- Newly placed orders save reviewed public fulfillment details in existing Payment.metadata.retailR4.fulfillmentInfo. Old orders are not backfilled with current instructions. Order.deliveryFee and item snapshots remain authoritative and immutable.
- Existing Retail confirmation shows timeline/refresh and saved instructions. The checkout layout is retained, with only configured fulfillment guidance added. Legacy Retail tracking labels are corrected without changing restaurant labels.

## Safety / scope

No Prisma schema change or migration. No shared DEMO order, stock, fulfillment-policy or payment-policy mutation in acceptance. No live payment activation, refund automation, carrier integration, notification integration, recovery work, homepage or product-detail redesign.

All mutating tests use the pre-existing guarded disposable PostgreSQL 16 database at loopback port 54713, database retail_p0_20261019. Hosted acceptance is read-only. Evidence and scripts are outside Git under `C:/Users/disso/.codex/artifacts/retail-r2-20261023/`.

## Merchant configuration still required

Merchants must supply actual pickup location/instructions, shipping restrictions, a real fee and any public contact information. A textual restriction is customer guidance, not an automated geographic coverage engine. Tracking references are recorded information, not live carrier tracking. Handover details are recorded at dispatch/collection/final-delivery actions; existing audited events are not silently edited. No free-shipping threshold or real delivery-time promise is introduced.
