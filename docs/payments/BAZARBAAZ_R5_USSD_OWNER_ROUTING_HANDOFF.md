# Bazarbaaz R5 — Platform-owner iNoti USSD routing handoff

Date: 2026-10-14
Status: ARCHITECTURE/IMPLEMENTATION HANDOFF — NO SOURCE CHANGE / NO LIVE PAYMENT

## Current Cafe Leo scope override (owner confirmed, 2026-10-14)

**This section supersedes any conflicting historical Cafe Leo custom-domain guidance below.**

- Cafe Leo must support **native ordering, cart, checkout, and purchase exclusively through its Bazarbaaz-hosted tenant Shop page** during this milestone. Reuse existing Bazarbaaz Retail R2–R4 catalog/cart/checkout/order capabilities where compatible.
- Cafe Leo USSD payments use **its own approved iNoti merchant account**, not the platform-owner account. Its storefront/order lifecycle remains on Bazarbaaz.
- **Do NOT integrate, call, import from, sync with, scrape, or deploy to `iran.cafeleo.vip` (or any prior external Cafe Leo menu/shop website) for this phase.** No website bridge, external catalog migration, API adapter, remote order write, or external callback dependency.
- The iNoti provider callback must use a Bazarbaaz-controlled verified Production endpoint with existing tenant/public-integration identity and applicable base path. This does NOT mean posting transactions to Cafe Leo's external website. Do not hardcode the platform domain blindly; derive origin from trusted public routing configuration and verify actual deployment.
- Keep any historical custom-domain references below **only as historical evidence of previous callback problems**, not as the implementation target.
- Native Cafe Leo Shop must be covered by authenticated customer cart/checkout and payment-pending browser tests, with correct Cafe Leo-owned USSD account binding and no external Cafe Leo host calls.

## Evidence classification

- User-confirmed policy: **every Bazarbaaz tenant except Cafe Leo must use the Bazarbaaz owner's iNoti USSD payment account for USSD transactions. Cafe Leo alone uses its own iNoti account.** Applies specifically to the iNoti USSD payment method, without rewriting unrelated bank-transfer/cash policies.
- Source-backed R4 state from accepted SHA `a51e8ddd18fe1b82d828d59fe078a182a34f23f0`: `lib/retail/inoti-readiness.server.ts` requires a tenant-owned non-platform profile and rejects `platformOnly`; integration status and global live-payment gates are checked; R4 checkout/payment code and PG17 CI were accepted. The current R4 implementation conflicts with the newly approved platform-shared account policy.
- Prior-chat historical evidence recovered as context, **not a direct full-text reading of the two private ChatGPT URLs**: USSD raw dial grammar `*6655*codeName*2*publicCode#`; normalized `6655*codeName*2*publicCode`; iNoti initiation response `9900|merchantFactorId|amountRial`; callback may carry merchant/provider factor IDs and RRN; authoritative SOAP `GetPayments` at `https://login.inoti.com/_services/ExternalUssdPay.asmx` with server-only `Username`, `Password`, `CodeName`; correlators include `YourFactorID`, `iNotiFactorID`, `SessionID`, canonical mobile, amount in Rial, RRN when provided, successful provider status. A historic genuine 9,500-Toman/95,000-Rial payment was reported with a 9-digit numeric merchant factor, but this DOES NOT establish currently active Production payment readiness or authorize more live transactions.
- **Historical-only** Cafe Leo context: previous external-website work discussed custom origins (including `https://iran.cafeleo.vip`) and `/app/api/integrations/inoti/ussd/{publicIntegrationId}`; a hardcoded callback origin was identified as a concern. **Do not connect to that external site in R5.** Confirm the current Bazarbaaz-owned callback endpoint and route/basePath for the in-platform Cafe Leo Shop.
- Both original private ChatGPT URLs were attempted and did not return their complete text. If exact historical message-level review is required, request a conversation export or pasted transcript; do not falsely claim full-link access.

## Deployment and database boundary

- Production identity previously verified by authenticated diagnostic: `neondb`, schema `public`, Neon endpoint `ep-little-river-aifwxtf7`, PostgreSQL 17.11, runtime role `neondb_owner`. A read-only diagnostic transaction does not make the owner role least-privileged.
- Subsequent cleanup report: temporary diagnostic removed; Vercel Production deployment `dpl_7hwJXyte1mLxQ7P7qa7AKorx4nuK` independently verified READY, with Bazarbaaz, Aka Shoes and Restaurant 13 aliases present. No read-only audit of the two tenant branding rows has happened; no Production DB writes are authorized here.
- R4 branch is isolated; keep hotel/PWA/main worktrees unchanged. Prefer CI PostgreSQL 17 for migrations and concurrency tests; do not build unnecessary local copies or consume Windows C: disk.

## Target payment account resolution

1. Resolve a trusted, active tenant organization ID from existing order/integration context, not from user-provided display strings, Host, CodeName, or untrusted query parameters.
2. Resolve the tenant's server-owned effective iNoti payment account policy:
   - DEFAULT: `PLATFORM_SHARED`, pointing at the platform owner's secured credential profile;
   - EXCEPTION: `TENANT_OWNED` for Cafe Leo's confirmed organization ID, pointing at its dedicated integration/profile;
   - UNAVAILABLE/UNVERIFIED: fail closed, not a silent fallback to a different account.
3. Represent Cafe Leo exception as a secured per-organization policy/configuration row, governed by platform SUPER_ADMIN and included in audit logs, rather than scatter `slug === "cafe-leo"` conditions around checkout or provider adapters.
4. Do not create one copy of the platform secret per tenant. Store credentials only in the approved server-side secret provider; reference the platform account by an opaque identifier. Never expose its username/password to tenant dashboards, frontend bundles, provider callbacks, traces, logs, artifacts or snapshots.
5. Bind every `PaymentRequest` / `UssdPaymentIntent` to: order ID, owning tenant organization ID, effective settlement/merchant account ID, credential/profile version or immutable account reference, the initiated CodeName, globally unique 9-digit numeric merchant-factor ID, exact Toman/Rial amount, canonical phone/session, expiration, and payment state. Reuse existing models when they already capture these fields; add the smallest additive migration only if needed.
6. On callback, recover the immutable payment-account binding from the initiated request; DO NOT re-resolve the *current* tenant policy, since it may have changed after initiation. Verify using the same designated merchant-account identity.
7. Verify via existing SOAP `GetPayments` response before settlement. Treat the callback as an untrusted hint. Match exact request/provider factors, session, mobile, Rial amount and RRN if present. Replays, out-of-order callbacks, mismatches and uncertain provider responses must never double-settle or mark `PAID`.
8. Convert Toman to Rial exactly once at the provider boundary. Keep stored authoritative retail order amounts in their existing currency convention; validate nonzero positive integer Toman for USSD where required. Never infer amount from provider callback alone.
9. Treat platform owner as payment-collecting merchant account, NOT as the owner of the tenant's order or customer. Orders, refunds/reconciliation, receipts and ledger entries remain tenant-qualified. Track collected cash and amounts payable to each tenant, accounting for charges, reversals and fee policy; payment processor readiness is distinct from owner-to-tenant disbursement readiness.
10. Preserve legacy USSD flows, Cafe Leo's own integration, restaurant order semantics, cash and bank-transfer modes, and existing iNoti SMS credential flows. Do not assume the SMS REST token authenticates SOAP payment methods.

## Concrete code reconnaissance before editing

- Start with accepted R4 SHA and inspect: `lib/retail/inoti-readiness.server.ts`, `lib/retail/checkout.server.ts`, `lib/retail/payment-policy.server.ts`, `lib/integrations/inoti-ussd/credentials.ts`, `lib/integrations/inoti-ussd/repository.ts`, provider parser / callback / `GetPayments` settlement services, `prisma/schema.prisma`, and any existing integration configuration or payment ledger abstractions.
- Enumerate existing provider profile keys and legacy tests *without reading or printing secret values*.
- Locate every tenant-owned-only/platform-only rejection and identify which ones should change for `PLATFORM_SHARED` while preserving all fail-closed checks.
- Identify existing `merchantFactorId` allocation and database uniqueness; ensure its 9-digit numeric space is safe across ALL concurrent tenants sharing the one provider account, with collision retries and transaction-safe idempotency.
- Verify that the callback resolves by public integration ID / immutable intent mapping rather than trusting the incoming host or tenant label; confirm applicable `/app` basePath and **Bazarbaaz-owned** callback routing for Cafe Leo (no external Cafe Leo website).

## Acceptance matrix — all offline/fixture-only until explicitly approved for live testing

- Tenant A (Aka Shoes) -> Bazarbaaz owner account; tenant B (Restaurant 13) -> SAME owner account; tenant C (new non-Cafe-Leo tenant) -> SAME owner account; their data and settlement remain strictly isolated.
- Cafe Leo -> its own verified integration/profile; never platform fallback when unavailable. Invalid/inactive/deleted orgs fail closed.
- Shared-account 9-digit merchant factors are globally unique even under concurrent requests across different tenants. Same idempotency key same request produces one intent; changed payload yields conflict; inventory and coupon semantics unchanged.
- Dial grammar, 9900 response, mobile/session normalization, exact Toman->Rial conversion; dry-run disabled -> zero 9900 / zero SOAP provider calls / zero settlement.
- Callback spoofing, wrong `SessionID`, mobile, amount, `YourFactorID`, `iNotiFactorID`, RRN, CodeName, owner account, expiration and replay all fail closed or stay pending.
- Late verified payment after cancellation enters reconciliation without reactivating fulfillment; duplicate callbacks cannot produce duplicate payment or ledger events.
- Policy switch during a pending request does not change which merchant credentials verify the original payment.
- Cafe Leo in-platform Shop checkout, provider-binding, Bazarbaaz-owned callback and applicable `/app` base path verified; zero requests to the external Cafe Leo website. No unverified, hardcoded callback origin.
- Browser checkout shows USSD only when effective account AND provider/payment rollout gates pass; bank-transfer/cash unchanged; tenant cannot edit shared platform credentials.
- Review monetary custody, reporting and any required merchant/provider contractual authorization before real tenant transactions.

## Phases & stop gates

**R5A — audited architecture + plan, no Production mutation:** inventory provider contracts, history and current code; produce exact impacted-file list, tenancy/policy matrix, migrations and test plan; block on missing verified Cafe Leo organization ID or absent platform credential account metadata; do not fetch secrets.

**R5B — isolated implementation:** implement immutable account binding and policy resolution with selective access changes; enable native Cafe Leo Shop ordering and checkout entirely within Bazarbaaz, using its dedicated verified iNoti account and zero external website integrations. Use guarded PG17 CI, native Shop browser acceptance, and synthetic provider fixtures. Keep Hotel/PWA/restaurants stable.

**R5C — operational qualification:** confirm iNoti's agreement permits collecting payments for multiple merchants through the platform owner's account, verify real account/profile readiness and private storage environment separately, reconcile payment ownership and disbursement accounting. Any real USSD, SOAP charge/payment, payment initiation or Production DB write is a separate explicitly authorized operation; no live payment automatically follows CI green.

**R5D — staged rollout:** one explicitly approved, bounded live test first; verify exact authorized request, amount, payer controls and callback/transaction audit; revert/disable immediately on mismatch, then expand by approved merchant rollout. Do not bypass Cafe Leo exception.

## Suggested Codex chief-agent request

Create an isolated branch `codex/retail-r5-platform-ussd-routing-20261014` based on the accepted R4 SHA `a51e8ddd18fe1b82d828d59fe078a182a34f23f0`. Start with R5A reconnaissance, then implement R5B without live provider calls. Maintain least-privilege separation, preserve exact contract and fully auditable tenant account selection. Ask for additional authorization only for actual Production database writes, profile provisioning in Production, live provider calls, merchant settlements or public rollout. Delegate bounded read-only tests/docs to cheaper agents. Use cloud PG17 CI for migrations and concurrency/browser tests. Return commit SHA, workflow URL, code-diff inventory, test matrix, blockers and precise activation prerequisites. Do not deploy Production or modify other worktrees.

## User-supplied historical ChatGPT conversation pointers (private; not directly fetched)

- https://chatgpt.com/g/g-p-6a354d76b750819189185a05e658c93a/c/6abbcbdc-d2e8-83eb-9c68-e6e5f9ca5d78
- https://chatgpt.com/g/g-p-6a0d9fd89a98819185c67f412e9a547a/c/6ac3975d-74c4-83ed-b218-6e050b67afa1

Direct access returned unavailable/cache miss. Do not claim these two full conversation transcripts were directly examined. The technical facts above were recovered from earlier conversation context and independent R4 review; use a transcript export for exact message-level provenance if needed.
