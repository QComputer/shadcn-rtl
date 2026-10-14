# Retail R5A — Platform-Shared iNoti USSD Architecture

**Baseline:** accepted R4 `a51e8ddd18fe1b82d828d59fe078a182a34f23f0`
**R5 branch:** `codex/retail-r5-platform-ussd-routing-20261014`
**Scope:** R5A findings, followed by an R5B implementation addendum. The implementation uses only fixture credentials and an isolated PostgreSQL 17 CI database; no Production or live provider operation is included.

## Decision and routing policy

The approved policy applies only to iNoti USSD payments:

| Effective organization policy | Merchant account | Failure behavior |
|---|---|---|
| `PLATFORM_SHARED` (default) | Bazarbaaz platform owner's iNoti merchant account | Fail closed if the account/profile or rollout is unavailable. Never fall back to a tenant account. |
| `TENANT_OWNED` (`CAFE_LEO` account key) | The organization assigned the dedicated Cafe Leo iNoti account through trusted persisted routing | Fail closed if its account/profile is unavailable. Never fall back to the platform account. |
| Missing, inactive, invalid, or unverified | None | Do not offer or initiate USSD; callback verification cannot settle. |

This policy does not rewrite bank-transfer or cash settings. The platform account is the payment-collecting merchant account only: orders, customers, payment requests, settlement records, refunds/reconciliation, and reporting remain owned by the purchasing tenant.

## R4 source findings

The R4 code has a real tenant-scoped iNoti integration and payment workflow, but its account routing does not implement the newly approved shared-account policy:

- `lib/retail/inoti-readiness.server.ts` reads the tenant's `OrganizationIntegration` and checks active status, connected health, payment-enabled configuration, credential availability, code-name agreement, dial-string readiness, and the global live-payment gate. It rejects `platformOnly` profiles, so a normal tenant cannot currently use the platform account.
- `lib/integrations/inoti-ussd/credentials.ts` resolves environment-backed profile keys and currently restricts them by organization slug. It contains separate platform, Aka Shoes, Cafe Leo, and Italiano 13 profile definitions. Runtime account selection must stop depending on these scattered slug restrictions. Secrets must remain in the server-side provider; this policy must not copy platform credentials into tenant configuration.
- `prisma/schema.prisma` has one `OrganizationIntegration` per `(organizationId, provider)`, with mutable `credentialProfileKey`, `codeName`, `configuration`, status, health, disable, and revocation fields. It is a tenant integration record, not a shared merchant-account registry.
- `PaymentRequest`, `PaymentProviderAttempt`, and `UssdPaymentIntent` already carry tenant organization ownership. The intent references its integration with the composite `(integrationId, organizationId)` relation. Preserve this invariant: account sharing must never share tenant order/customer/financial rows.
- `UssdPaymentIntent.merchantFactorId` is globally unique today, while related attempt/factor uniqueness is keyed partly by `providerIntegrationId`. That does not explicitly model uniqueness in the shared merchant-account namespace. R5 must make the database invariant match the provider's actual factor namespace.
- `lib/integrations/inoti-ussd/repository.ts` creates/reuses intents and performs durable tenant-scoped settlement. `lib/integrations/inoti-ussd/workflow.ts` emits the existing `9900|merchantFactorId|amountRial` response and receives the USSD callback in the resolved integration context.
- `lib/integrations/inoti-ussd/inoti-provider.ts` implements SOAP `GetPayments` verification using the server-held username/password and the provider correlators. It must remain the authority for settlement; callback fields are untrusted hints.

The handoff records prior historical evidence for a 9-digit numeric merchant factor, dial grammar `*6655*codeName*2*publicCode#`, and provider endpoint `https://login.inoti.com/_services/ExternalUssdPay.asmx`. These are contract inputs to verify with offline fixtures and source tests. They do not prove current live readiness. No provider call is authorized by this architecture phase.

## R5B implementation addendum

- The persisted key is `OrganizationInotiPaymentRouting.merchantAccountKey`: `PLATFORM_OWNER` represents the approved platform-shared account and `CAFE_LEO` represents the dedicated Cafe Leo account. Every existing and newly created organization receives the shared key. The migration does not infer a dedicated tenant from a slug; the Cafe exception must be assigned by a trusted audited operator after the organization ID and account mapping are verified. The setter requires `INOTI_CAFE_LEO_ORGANIZATION_ID` to match the target organization ID, and the partial unique index prevents assignment of the dedicated account to multiple organizations.
- Production credential lookup maps those opaque keys to server-only environment profiles. It does not copy credentials into tenant records. Checkout readiness resolves the persisted policy plus the tenant's active/healthy integration and existing rollout gates.
- `PaymentRequest`, `PaymentProviderAttempt`, and `UssdPaymentIntent` carry the immutable merchant-account/profile-key/CodeName binding. Existing intents are backfilled to `LEGACY_INTEGRATION:<integrationId>` to preserve their original verifier. New nine-digit numeric factors are unique within the account key. Intent, request, attempt, order, and settlement ownership remains tenant-qualified.
- Callback handling still starts from the Bazarbaaz public integration ID, locates the tenant-owned intent, and calls the existing `GetPayments` verifier using the saved account snapshot. The current canonical callback helper remains Bazarbaaz-owned; its Production origin and deployed `/app` base-path still require operational verification before activation.
- The native `/{locale}/{organization}/shop/checkout` URL selects the shared R4 Retail checkout client only when persisted Retail theme and published-state configuration are present. Other shops retain the legacy checkout route. The Cafe acceptance fixture uses a synthetic product and a loopback-only iNoti endpoint; checkout leaves the order pending and does not initiate or settle a payment.
- The exact approved handoff was imported from documentation commit `9e2cbd4e6452dea1a41a0fd8c793a712242f5545` by path only. Its parent ancestry is not part of this R5 branch.

The real Cafe Leo organization ID and dedicated account readiness were not read from Production and are not claimed verified. Production routing remains an explicit activation blocker until that identity/profile mapping is confirmed through an approved operator workflow.

## Target architecture and trust boundaries

### Effective account policy

Resolve policy only on the server from a trusted organization ID obtained from the tenant-owned order/integration context. Do not select an account from request parameters, host headers, callback `CodeName`, user-visible slugs, or a client-supplied organization ID.

Represent the effective merchant account as an opaque account reference backed by a server-owned account registry/secret-provider mapping. The organization policy/configuration should choose `PLATFORM_SHARED` or a specific tenant-owned account reference. Platform administrators control this routing configuration; tenant managers may enable the payment method only when the effective account and rollout checks pass, and may not change the account reference or inspect account credentials.

The default and Cafe Leo exception must be persisted as trusted per-organization configuration (or an equivalent centrally governed policy record), with actor, timestamp, previous/new value, and reason in audit history. Do not implement `slug === "cafe-leo"` branches in checkout, readiness, workflow, or provider code. A one-time provisioning/backfill may identify the Cafe Leo organization, but it must resolve and verify the organization ID before writing the policy. **The verified Cafe Leo organization ID and verified account/profile mapping are prerequisites to finalizing that configuration.** Until then, do not silently infer the exception or enable USSD for that organization.

Keep `OrganizationIntegration` as the tenant-facing integration/callback binding. Its public ID and callback lifecycle can remain tenant-scoped even when multiple integrations resolve to one merchant account. Account policy selects provider credentials; it must not change callback tenant ownership.

### Immutable pending-payment binding

At payment-intent creation, snapshot an immutable binding sufficient to verify later under the same merchant account even if policy changes while the intent is pending:

- tenant `organizationId`, order/payment-request IDs, and tenant integration ID;
- opaque merchant account ID/key and immutable credential/profile version or reference;
- the exact code name used for the request;
- numeric merchant factor ID, exact Toman amount and corresponding Rial amount;
- session/mobile evidence hashes or existing canonical evidence, expiry, and state.

Use existing fields where they already express the contract. Add only the smallest additive schema change needed for immutable account/profile binding and account-scoped uniqueness. Do not store credential values in these rows. Restrict updates to binding fields after creation; state transitions and verification evidence remain separately auditable. The callback must locate the tenant intent through the trusted public integration ID and callback correlators, then use the intent's stored account binding for SOAP verification. It must not re-resolve the tenant's current policy to decide which credentials verify an already initiated payment.

The platform account identity must not replace the tenant organization identity in `PaymentRequest`, `Order`, customer relations, settlement, or audit ownership. Preserve all existing composite organization foreign keys and tenant-scoped transaction checks.

## Callback, amount, and factor safety

1. Treat callback host, code name, session, mobile, factor IDs, RRN, and amount as untrusted input. Route through the canonical callback path's public integration identifier plus a tenant-owned persisted intent. Verify exact tenant integration/order linkage and immutable account binding before querying the provider.
2. Run existing SOAP `GetPayments` verification with the credentials bound to the intent. Require exact merchant factor, provider factor when present, session/mobile correlators, Rial amount, successful provider status, and RRN when supplied by the contract. A callback alone never marks a request paid.
3. Convert Toman to Rial exactly once at the provider boundary. Validate a positive integer Toman amount before intent creation; compare the verified provider amount against the persisted Rial snapshot. Do not derive totals from callback data.
4. Make merchant-factor allocation numeric and exactly nine digits if that is confirmed by the accepted provider contract. Since all default-policy tenants share one provider merchant account, uniqueness must be enforced across the **account**, not merely per tenant integration. Use a database unique constraint scoped to the effective account reference and collision-safe allocation/retry within a transaction. Verify existing global uniqueness semantics before migration; do not weaken an existing constraint before proving data compatibility.
5. Preserve idempotency for repeated identical requests, reject changed-payload reuse, and prevent concurrent tenants from receiving the same account-scoped factor. Duplicate/replayed callbacks must not double-settle or duplicate ledger/audit effects. Late verification after cancellation must enter reconciliation without reactivating fulfillment.
6. Cafe Leo's callback origin and `/app` base-path behavior are not established by the accepted R4 source. The handoff's historical `iran.cafeleo.vip` URL is explicitly unverified. Confirm its current canonical public endpoint before rollout; do not assume or hardcode the platform domain for Cafe Leo.
7. Preserve the existing `9900|factor|amountRial` provider command, callback verification, restaurant order semantics, SMS credential flow, and bank-transfer/cash methods. SMS tokens do not authenticate the SOAP payment contract.

## Minimal expected schema impact

No migration was applied during R5A. The implementation review should first compare these proposed needs with all current models and migrations:

- A trusted organization-to-effective-merchant-account policy/reference, preferably represented with a typed policy/account identity and audited changes. It must be inaccessible to tenant-manager mutation routes.
- Immutable merchant-account/profile-version reference on the pending payment/intent (or a narrowly scoped binding model with tenant composite relations) so policy changes cannot reroute an outstanding payment.
- Database uniqueness for merchant factor within the effective shared account namespace, plus any supporting index needed for allocation/lookups.

Do not duplicate `PaymentRequest`, `PaymentProviderAttempt`, `OrganizationIntegration`, order, or ledger models. Keep any migration additive and backward-compatible for existing restaurant USSD records: existing rows need an explicit verified legacy account binding or a fail-closed/manual-review state, never a guessed account. Prove the migration and constraints against an empty disposable PostgreSQL 17 database plus synthetic legacy restaurant fixtures in CI. No Production migration is authorized.

## Impacted source areas for R5B

Expected review/implementation surface (subject to exact contracts found while editing):

- `prisma/schema.prisma` and a new additive Prisma migration for trusted policy/account binding and factor uniqueness, only if existing schema is insufficient.
- `lib/integrations/inoti-ussd/credentials.ts` and a server-side account resolver/registry to separate credential ownership from tenant ownership and remove runtime slug-based account routing.
- `lib/retail/inoti-readiness.server.ts`, `lib/retail/payment-policy.server.ts`, and checkout policy checks to resolve the effective account while retaining existing capability, integration health, rollout, and global safety gates.
- `lib/integrations/inoti-ussd/repository.ts`, `workflow.ts`, callback/durable verification paths, and allocation service to snapshot the binding, allocate account-unique factors, route verification by the immutable binding, and preserve tenant-scoped settlement.
- Seed/provisioning/configuration path for explicit `PLATFORM_SHARED` defaults and the verified Cafe Leo exception; audit and permission coverage must show only trusted platform operators can alter routing.
- Focused unit/integration tests and PostgreSQL 17 CI acceptance. No changes to PWA branding, Hotel routing/business logic, or shared deployment configuration are in scope.

## Acceptance plan (offline fixtures only)

- Resolve default and exception policies from persisted trusted configuration; verify missing, disabled, deleted, and unverified organizations fail closed.
- Demonstrate Aka Shoes, Restaurant 13, and a third synthetic tenant resolve the same platform account while their orders, customers, intents, attempts, and settlement rows remain organization-isolated.
- Demonstrate Cafe Leo resolves only its dedicated account; if its organization ID or account mapping is not verified, the test must assert disabled/fail-closed behavior.
- Verify tenant managers can enable an available payment method but cannot edit account routing or credentials; unauthorized and cross-tenant attempts are denied and audited appropriately.
- Start USSD intents for separate tenants concurrently and prove nine-digit factors are unique within the shared account. Verify idempotent retries produce one intent and changed payload conflicts.
- Exercise existing dial parsing and `9900` output, numeric factor validation, exact Toman/Rial conversion, `GetPayments` fixture verification, all callback mismatch/replay cases, duplicate settlement prevention, expiry/cancellation, policy changes during pending payment, and late-payment reconciliation.
- Preserve existing restaurant USSD behavior, cash/bank-transfer behavior, SMS credentials, and current rollout/live-payment gates. Use an injected fake provider only; assert provider-call count is zero when the global gate is disabled.
- Run Prisma validation, migration deploy against disposable PostgreSQL 17, relevant type/lint/unit/integration regressions, production build and browser smoke only in an adequately provisioned isolated runner. No test may use Production credentials or data.

## Explicit operational gates

This R5A/R5B work is not authorization to transact or deploy. At this stage:

- **No live provider calls or payment initiation.**
- **No Production/Neon database writes or migrations.**
- **No Production deployment, promotion, merge, or rollout.**
- **No Production credential retrieval, printing, copying, or snapshotting.**
- **No real merchant payment, settlement, refund, or disbursement.**

Before any later live rollout, separately verify that iNoti's merchant agreement permits the platform owner's account to collect on behalf of multiple merchants; verify account/profile readiness and Cafe Leo's dedicated profile; establish payment custody, reconciliation, fees, reversals, refunds, and tenant disbursement accounting; confirm Cafe Leo's canonical callback domain/base path; review least-privilege Production configuration and monitoring; and obtain explicit authorization for any bounded live test. CI green is not live readiness.

## Safe rollout sequence

1. Complete R5B with fixture-only account resolution and strict zero-provider-call tests when disabled.
2. Validate additive migrations and concurrency/isolation tests on disposable PostgreSQL 17 in CI; keep Production untouched.
3. Review the final diff and CI artifacts for secrets, deployment triggers, tenant-routing changes, and regressions in Hotel/PWA/restaurant paths.
4. Provision trusted policy and account references through an audited privileged mechanism only after Cafe Leo organization/account identifiers are verified. Keep USSD unavailable where mappings are incomplete.
5. Complete the independent contractual, custody, disbursement, callback-origin, and operational gates above.
6. Any live test requires separate explicit authorization and must be bounded to a reviewed merchant, amount, payer, and callback; stop and disable on any mismatch. Expand only after reconciliation is verified. Do not infer authorization from historical live-test reports or automated tests.
