# SnappPay Self API contract and lifecycle readiness

Updated 2026-11-28. This document separates provider-published setup facts, static implementation observations, and the still-missing merchant Self API contract. It contains no merchant secrets, tokens, customer data, or credential values.

## Official sources inspected

- Merchant technical-access page: <https://portal.snapppay.ir/credentials> (authenticated, read-only).
- Official activation guide: <https://academy.snapppay.ir/2026/04/21/activation/>.
- Official technical-credentials guide: <https://academy.snapppay.ir/2026/06/06/snapppay-gateway-tech-guide/>.
- Official WooCommerce integration setup article: <https://academy.snapppay.ir/2026/03/03/%D8%A7%D9%81%D8%B2%D9%88%D9%86%D9%87-%D9%81%D8%B9%D8%A7%D9%84%D8%B3%D8%A7%D8%B2%DB%8C-%D8%AF%D8%B1%DA%AF%D8%A7%D9%87-%D8%A7%D9%82%D8%B3%D8%A7%D8%B7%DB%8C-%D8%A7%D8%B3%D9%86%D9%BE%D9%BE/.
- Sanitized static review of official WooCommerce plugin v1.4.2 and official Searchwise catalog material is documented in the separate PR #200 integration handoff. Plugin behavior is not treated as the Self API contract.

## What the official portal and guides verify

- The portal labels a **Production Base URL** and currently displays the production host `api.snapppay.ir`. No Stage endpoint or Stage credentials were visible in the inspected portal page.
- The official technical guide names these integration credentials: Client ID, Username, Client Secret, and Password. It says Client Secret and Password are not displayed by default and are one-time generated values; regeneration disables the preceding values. No regenerate controls were used.
- The activation guide says custom implementations need a registered Production IP and HTTPS return/callback URL. It describes receiving Self integration documents and Stage access from SnappPay’s technical/activation team before custom implementation and testing.
- Official setup text instructs a merchant to use the gateway’s payment link in its storefront. It does not define redirect host validation, callback signature, callback acknowledgment, or payment-state semantics.
- The public guide describes the consumer installment plan at a high level. The merchandise price adjustment is a merchant-owned pricing policy and is not a SnappPay protocol parameter, provider-calculated fee, or provider-controlled percentage. The merchant must continue to follow applicable agreement and contractual requirements; separate provider approval of exactly 11% is not an activation gate.

## Self API contract status by topic

“Static plugin observation” below means only that the official plugin source appears to do that. It is not a verified merchant API requirement and is not implemented here.

| Topic | Verified official Self API requirement | Static plugin observation / remaining question |
|---|---|---|
| Authentication | Credential names are confirmed by the official portal guide. | Plugin v1.4.2 appears to use Basic auth with a password-grant token request and then Bearer access tokens. Token endpoint, parameters, expiry units, refresh/renewal, invalidation and exact errors require the merchant Self API specification. |
| Eligibility inquiry | No Self API endpoint or schema published in the inspected official guides. | Plugin source observes an eligibility request and `eligible` result. Amount units, customer dependence, freshness, error policy and whether it must run again at payment creation are unresolved. |
| Payment creation | No Self API endpoint, request schema, idempotency contract or response schema published. | Plugin appears to submit an installment payment token request with amount, transaction ID, return URL and cart fields. Types, required fields, limits, discount/tax formula and duplicate-transaction behavior remain unverified. |
| Redirect | Official setup instructs using the payment link. | Plugin reads a `paymentPageUrl`. Allowed redirect origins, URL lifetime, error responses and whether this is the only supported redirect mechanism are unresolved. |
| Callback | The merchant registers an HTTPS return/callback URL during setup. | Plugin checks a callback `state` value but no signature, full field set, method/content-type, acknowledgment, replay or retry contract is verified. A browser return alone cannot settle an order. |
| Verification | No public Self API verification contract found. | Plugin appears to call a verify operation with a stored payment token. Exact operation, response fields, amount/currency binding, timing and idempotency are unresolved. |
| Settlement | No public Self API settlement contract found. | Plugin appears to call settle after verify. It can show a success notice even when settlement fails, so that behavior is explicitly rejected. Merchant financial success must follow authoritative verified state. |
| Cancellation | No public Self API cancellation contract found. | Plugin appears to call cancel or inspect status. Status meanings, legal states, inventory behavior and cancellation idempotency are unresolved. |
| Refund / partial refund | No official contract found. | Plugin source does not establish a refund or partial-refund API. No capability is enabled or inferred from cancel. |
| Reconciliation | Official public material mentions reviewing orders/finance in the merchant portal, not an API reconciliation protocol. | Plugin appears to read a status operation. Reconciliation fields, windows, polling limits, settlement vs merchant payout, and mismatch handling remain unresolved. |
| Error codes | No authoritative Self API error catalog found. | Plugin consumes several broad response fields. Codes, HTTP status meanings and safe customer-facing mapping are unknown. |
| Timeouts / retries | No provider SLA, timeout or retry rule found. | Plugin uses a 30-second cURL timeout and retries one 401 after obtaining a token; these are source implementation choices, not provider policy. Unknown outcomes must not trigger a second payment attempt automatically. |
| Idempotency / concurrency | No provider idempotency contract found. | Plugin transaction IDs and order metadata do not prove provider-side idempotency. Local durable deduplication, compare-and-set state transitions and reconciliation are required before any financial side effect. |
| Amounts / rounding | The official integration guide does not define Self API units or rounding. | Plugin source appears to send integer IRR in its examples. Merchant checkout stores Toman. Conversion, discount allocation, supported precision, rounding and provider cart arithmetic must be confirmed from the Self contract. |
| Environments | Production host is visible in the authenticated portal. | Stage URL, credential separation and Stage data/reset rules are unavailable. Production endpoint use is prohibited in this work. |
| Credential storage | Official guide identifies Client Secret and Password as confidential and warns regeneration disables prior values. | Bazarbaaz must resolve the existing tenant-scoped credential-vault reference at runtime. No portal credentials were copied, generated, rotated, or added to the repository. |

## Provider-independent lifecycle foundation in this PR

- Exact settlement decision gate after a provider adapter has normalized its response into Toman: positive immutable expected amount, exact amount match, explicit `TOMAN` currency and nonempty provider transaction identity are required.
- Unknown/timeout/unavailable results route to reconciliation; they do not settle, fail definitively, or authorize a duplicate attempt.
- Same callback fingerprint can be classified as replay; conflicting bytes are rejected. This helper is not authentication and is not a durable deduplication store. Durable atomic storage needs the coordinated schema extension described below.
- Audit helper keeps only local opaque identifiers and a tightly allowlisted code; callback bodies, tokens, credentials and raw provider messages are excluded.
- Cancellation, full refund and partial refund are explicitly unavailable until the official contract is reviewed.
- No live provider adapter, request, redirect, callback endpoint, verification call, settlement call or credential resolver is implemented. Existing checkout remains default-disabled for SnappPay.

## Schema coordination and activation gates

Existing `PaymentRequest` and `PaymentProviderAttempt` models offer tenant-scoped request/attempt identities, amount fields, integration binding, state and conditional-update support. Additive migration `20261128150000_snapppay_payment_lifecycle` adds the tenant-scoped merchant pricing policy, immutable installment quote/line snapshot, and append-only provider-event deduplication ledger. Agent 1 confirmed PR199 has no schema overlap and the proposed migration ordering is clear. Provider request/response correlation and authoritative provider operations remain pending contract validation.

Activation remains blocked on: the merchant-specific Self API specification, tenant-isolated credential-vault readiness, Stage URL/credentials and acceptance, registered callback/egress IP, completed lifecycle tests against the contract, merchant contractual compliance, and separate owner authorization. Provider approval of the exact 11% merchant pricing policy is not a standalone gate. There have been no Production database, configuration, deployment, live payment, or provider activation changes.
