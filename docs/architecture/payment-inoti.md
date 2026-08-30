# Payment and iNoti architecture

## Scope and invariants

This document defines the BB-P1 payment boundary and the BB-P2 verified lifecycle. It reconciles the existing order, `PaymentRequest`, provider-attempt, iNoti USSD, callback, and settlement code; it does not introduce a new checkout product.

- Commerce amounts are positive integer **Toman**. `Order.total`, `PaymentRequest.amountToman`, and `PaymentProviderAttempt.amountToman` are internal money.
- iNoti expects **Rial**. Conversion is exactly `rial = toman * 10`, once, at the provider boundary. `UssdPaymentIntent.amountRial` is deliberately provider-denominated evidence.
- A payable order or appointment creates a tenant-owned `PaymentRequest`; each provider interaction creates a tenant-owned attempt. A request and attempt may never reference another organization's order, appointment, customer, guest, or integration.
- Credentials are resolved from the integration's explicit credential profile. A tenant profile never falls back to platform credentials.
- `PUBLIC`, `APP`, and `CALLBACK` endpoints have different authority. The public site can express purchase intent, the operational app owns authenticated commerce, and the opaque callback URL only accepts provider input.
- Callback receipt, provider factor ID, and RRN are untrusted evidence. None marks a payment paid. Successful `GetPayments` verification with exact session, mobile, amount, merchant factor, provider factor, RRN, and success-result matching is required.
- Verified settlement is one transaction. It settles the intent, request, attempt, order financial status, payment row, event, and audit record idempotently. It does not advance fulfillment status.
- iNoti USSD is recorded as `INOTI_USSD`, not as bank transfer. Notification delivery is downstream and cannot redefine payment truth.

## State ownership

`PaymentRequest` is the provider-neutral financial intent:

`CREATED -> AWAITING_CUSTOMER -> PENDING_VERIFICATION -> PAID | FAILED | EXPIRED | CANCELLED`

`PaymentProviderAttempt` records one provider interaction:

`CREATED -> AWAITING_CUSTOMER | PENDING_VERIFICATION -> VERIFIED | FAILED | EXPIRED | CANCELLED`

Same-state writes are allowed for idempotent retry. Terminal states do not reopen. Transport timeout, malformed provider response, provider error, and temporary not-found are ambiguous and stay `PENDING_VERIFICATION`; an exact verified-record mismatch is terminal failure. The provider-specific intent may return from `VERIFYING` to `REQUESTED` for a retryable verification failure, but `SETTLED` is terminal.

The order's `paymentStatus=COMPLETED` means the financial obligation was verified and settled. It is independent from the order fulfillment status.

## Request and callback flow

1. Resolve the organization and payable server-side; never accept tenant or amount authority from callback parameters.
2. Parse the order total as positive integer Toman, create/reuse its request and attempt, then convert once to Rial when creating the iNoti intent.
3. Give iNoti the canonical HTTPS callback containing only the opaque public integration UUID.
4. On callback, resolve that UUID to one active tenant integration, hash sensitive callback identifiers, locate the tenant-owned intent, and record receipt evidence.
5. Query `GetPayments` read-only using the tenant credential profile and exact expected fields.
6. Settle only a fully matching successful record and only when both live-payment and runtime-mutation gates are explicitly enabled. Duplicate callbacks return the settled result without a second financial transition.

## BB-P2 verified lifecycle

An order-backed or standalone request is created from authoritative server state. Initiation creates or reuses one iNoti attempt for that request, generates a non-secret `BZ` factor bound to the integration, and serializes `9900|YourFactorID|Price` with the amount converted from Toman to Rial exactly once. Repeated initiation for the same request reuses the durable attempt and intent.

The callback route remains the stable platform-controlled machine boundary at `/api/integrations/inoti/ussd/{publicIntegrationId}`. Its host, RRN, factor, session, mobile, and call data are correlation input only. The route resolves the opaque integration ID, records hashed or masked evidence, and invokes the configured provider adapter. There is no public mock selector; BB-P2 runtime tests inject a fixture provider into the same route handler.

Provider selection accepts exactly one successful record matching the integration account, session, normalized mobile, expected Rial amount, merchant factor, and the callback's provider factor and RRN. Provider factor and RRN are optional only until supplied by the callback; once supplied they are mandatory confirming fields. No result, timeout, transport failure, malformed response, and ambiguous matches remain retryable. A proven correlation mismatch is terminal and never marks the request paid.

The current provider contract reveals the provider factor and RRN through callback evidence, so BB-P2 does not weaken correlation to implement callback-free polling. A lost-callback verifier would need a separately proven provider query that can select one record without those fields. Retry scheduling and an authorized payment-status read surface remain operational wiring for BB-P3; existing order-status reads are not treated as a provider-neutral `PaymentRequest` status endpoint.

Settlement uses a database transaction, a conditional intent claim, unique request-to-intent and provider-identity constraints, and a settlement-specific idempotency key. Concurrent verifiers may observe the same provider proof, but only one can create the financial transition and audit event. The others resolve as duplicates. Order-backed settlement sets `paymentStatus=COMPLETED` while leaving fulfillment `status` unchanged. Standalone requests settle to `PAID` without an order write.

Disabling `paymentEnabled` prevents new initiation. It does not erase or refuse evidence for an already-created payment: callbacks may still be verified and reconciled when the independent live verification and settlement gates permit it. This distinction prevents a configuration toggle from stranding customer money while keeping new financial activity fail-closed.

The money migration renames legacy request/attempt Rial columns to Toman and divides exact multiples of ten once. It aborts on non-divisible or non-positive values. Provider evidence in `UssdPaymentIntent.amountRial`, factor, session hash, and RRN is preserved. Disposable PostgreSQL acceptance covers ordinary, minimum, and large values and a repeated migration deploy.

Verified provider payments arriving after a request is `EXPIRED` or `CANCELLED` do not reopen or auto-settle the request. The provider proof is retained as `VERIFIED` evidence with `reconciliationRequired=true` and an audit record. Refund, credit, or manual-acceptance handling remains a product and operations policy for BB-P3; automatic financial state mutation is intentionally forbidden.

## BB-P3 production gates

- Production must apply every repository migration, including the money reconciliation and BB-P2 intent uniqueness/standalone migration, before compatible code is deployed.
- Each rollout integration needs a genuine tenant-owned CodeName and credential profile. Aka Shoes remains blocked until its real CodeName is established; Italiano 13 is not a rollout target.
- Operations must define late-payment handling, alerting/reconciliation ownership, callback latency monitoring, retry scheduling, and payment-status client behavior.
- Live verification, live payment, and runtime provider mutation gates remain independently fail-closed. Enabling them requires an explicitly authorized production rollout; BB-P2 does not enable any gate.

## BB-P3 production operating decisions

The public status boundary is a read-only possession-authorized lookup at `/api/payments/{publicPaymentId}`. The random UUID is distinct from internal IDs and tenant identifiers. The response exposes only provider-neutral state, amount/currency, purpose, and safe timestamps. `PENDING_VERIFICATION` is represented as "Payment is being verified" and is never shown as paid or definitively failed. The endpoint is rate limited using the existing primitive and returns generic not-found/unavailable errors.

The operator boundary is an authenticated, tenant-scoped reconciliation queue at `/api/organizations/{id}/payments/reconciliation`. It classifies provider-result pending, terminal failure, late verified money, security anomaly, and manual review without exposing callback evidence, raw failure values, session/mobile data, provider factors, RRN, or credentials. A verified payment on an expired or cancelled request is retained as evidence and routed to refund, credit, or explicitly approved manual acceptance; it never auto-pays, auto-reopens, or auto-fulfils.

Durable retry is an activation prerequisite, not an in-process timer. The present strict `GetPayments` query needs callback-supplied correlation values that are intentionally stored only as hashes or masks. Until provider callback retry is proven or an approved encrypted correlation envelope/durable worker exists, callback-free reconciliation is blocked. Correlation cannot be weakened to manufacture a poller. Retryable provider outcomes remain pending; ambiguous, mismatch, replay, exhausted, and late-payment cases are operator-visible.

The callback remains on the platform-controlled `https://bazarbaaz.ir` origin and uses only the opaque integration UUID. It is independent of tenant `PUBLIC` and `APP` hosts. Callback cutover pauses new initiation, preserves the old path for in-flight payments, verifies the new path, observes the overlap window, and retires the old path only after reconciliation.

Activation has separate dimensions rather than one database enum: configuration state, tenant `paymentEnabled`, live-verification gate, live-payment gate, runtime-mutation approval, monitoring readiness, durable reconciliation readiness, and rollout phase. A useful operational projection is `NOT_CONFIGURED`, `CONFIGURED_DISABLED`, `VERIFICATION_READY`, `CANARY_ENABLED`, `ACTIVE`, or `PAUSED`. No global variable can bypass tenant `paymentEnabled`, and the tenant flag cannot bypass global gates. Pausing initiation must preserve safe reconciliation of existing payments.

The money migration and compatible application revision form one release boundary. Old application/new schema and new application/old schema are unsafe combinations. After migration, rollback should normally be feature-gate pause plus forward-fix. Database restore does not reverse iNoti/bank truth; after any real transaction, provider reconciliation precedes every restore or schema reversal. The actionable deployment, checkpoint, canary, pause, and escalation procedure lives in `docs/runbooks/inoti-payment-production.md`.

## Rollout inventory

| Target | BB-P1 disposition | Notes |
| --- | --- | --- |
| Bazarbaaz platform | eligible after environment/provider readiness proof | Dedicated platform profile and opaque callback ID; no tenant fallback. |
| Cafe Leo | eligible after environment/provider readiness proof | Dedicated Cafe Leo profile and integration required. |
| Aka Shoes | eligible after environment/provider readiness proof | Dedicated Aka Shoes profile and integration required. |
| Italiano 13 | excluded | Owner decision is no USSD. Existing seed/profile fixtures are legacy drift and must not be treated as rollout authorization. Removal requires a separately approved cleanup. |

No row in this table authorizes a real payment, SMS, provider-side change, deployment, database mutation, or production migration. Readiness proof must report configured identifiers and gates without revealing secrets.

## Operational safety

Live verification requires `INOTI_USSD_LIVE_VERIFICATION_ENABLED=true`. Financial settlement additionally requires both `INOTI_ALLOW_LIVE_PAYMENTS=true` and `INOTI_RUNTIME_MUTATIONS_APPROVED=true`. Production hashing requires `INOTI_USSD_HASH_PEPPER`. Defaults fail closed.

Provider timeouts are bounded. Database settlement uses a bounded transaction and unique callback, merchant-factor, provider-factor, RRN, and payment transaction identities. Logs and audit metadata use hashes or masked values; credentials and raw sensitive identifiers must not be emitted.

Schema changes are additive/renaming reconciliation: existing Rial request/attempt amounts must be exactly divisible by ten before conversion to Toman, otherwise migration aborts. Production migration remains a separate, explicitly authorized operation.
