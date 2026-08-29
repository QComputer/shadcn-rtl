# Payment and iNoti architecture

## Scope and invariants

This document defines the BB-P1 payment boundary. It reconciles the existing order, `PaymentRequest`, provider-attempt, iNoti USSD, callback, and settlement code; it does not introduce a new checkout product.

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
