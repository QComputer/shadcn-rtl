# iNoti payment production runbook

## Scope and P0 rules

This runbook prepares a controlled production rollout. It does not authorize a migration, deployment, provider change, feature-gate change, or real payment.

- Keep new payment initiation disabled until schema, compatible app revision, provider configuration, monitoring, and durable reconciliation are all ready for one target.
- A callback is evidence, not payment truth. Only exact `GetPayments` verification can settle a payment.
- Disabling initiation must not disable safe verification of payments already started.
- An iNoti or bank payment cannot be rolled back by restoring Bazarbaaz Postgres. After the first real payment, reconcile provider truth before any database restore or schema reversal.
- Never auto-mark an expired or cancelled request paid. Verified money on either state is `RECONCILIATION_REQUIRED`; an authorized operator chooses refund, credit, or manual acceptance, and fulfilment remains unchanged.

## Preconditions

1. Identify the exact application commit and production database branch.
2. Confirm the five pending migrations, in repository order:
   1. `20260826000100_product_media_assets`
   2. `20260827_organization_branding`
   3. `20260827_public_home_mode`
   4. `20260830000100_reconcile_payment_money_semantics`
   5. `20260830000200_inoti_payment_e2e`
3. Repeat the read-only money checks immediately before migration: non-positive request/attempt amounts, legacy Rial values not divisible by ten, duplicate payment intents per `(paymentRequestId, organizationId)`, and unresolved failed Prisma migrations must all be zero.
4. Confirm a current recovery checkpoint. For Neon, create and label a root-branch snapshot or record a point-in-time restore checkpoint within the configured retention window; verify it can be previewed before restore. See [Neon database versioning with snapshots](https://neon.com/docs/ai/ai-database-versioning) and [Neon branching](https://neon.com/docs/guides/branching-intro).
5. Confirm the maintenance/traffic-restriction window. Old application code is incompatible with the renamed Toman columns, and new application code is incompatible with the old schema.
6. Assign named payment operator, incident commander, and provider contact. Confirm alert delivery before enabling any target.

## Read-only target preflight

Run from the release revision with production database variables supplied through the approved secret mechanism:

```powershell
pnpm exec tsx --require=./scripts/e2e/register-server-only.cjs scripts/inoti/payment-production-preflight.mts bazarbaaz-platform cafe-leo aka-shoes
```

The command uses read-only database statements, makes no provider call, creates no payment, prints no credential value, and reports each tenant independently. `ITALIANO 13` is intentionally not a rollout target.

Required evidence for each target:

- all repository migrations applied and `amountToman` present on request and attempt;
- exactly one active `INOTI_USSD` integration owned by that organization;
- genuine CodeName and supported credential profile present;
- canonical callback derived as `https://bazarbaaz.ir/api/integrations/inoti/ussd/{opaque-public-integration-id}`;
- customer status route and operator reconciliation route present;
- monitoring and durable reconciliation declared ready;
- all gates still disabled before the scheduled canary.

The preflight's operational flags are evidence inputs, not activation switches: `INOTI_PAYMENT_MONITORING_READY` and `INOTI_PAYMENT_RECONCILIATION_WORKER_READY` do not enable runtime payment behavior.

## Migration and deployment order

The production executor must use the approved release system; the commands below are a plan, not permission to run them.

1. Record commit, migration count, current Prisma migration state, row counts, and recovery checkpoint time/ID.
2. Disable or drain application traffic that can touch payment request/attempt columns. Keep provider callback ingress observable; if callbacks could arrive, capture/replay must be an approved durable mechanism rather than process memory.
3. With `DATABASE_URL` and `DIRECT_URL` pointing to the same approved production database, run `pnpm exec prisma migrate deploy` once.
4. Verify all five migrations are finished, no failed migration is unresolved, Toman columns and constraints exist, and duplicate-intent checks remain zero.
5. Deploy the BB-P3-compatible application revision. Do not roll traffic back to the pre-money-schema revision.
6. Run non-mutating health checks, then restore normal non-payment traffic.
7. Keep `INOTI_ALLOW_LIVE_PAYMENTS=false`, `INOTI_RUNTIME_MUTATIONS_APPROVED=false`, tenant `paymentEnabled=false`, and live verification off until the separately authorized target canary.

## Compatibility and application rollback

| Application | Schema | Result |
| --- | --- | --- |
| old | old | Current safe baseline with payment disabled. |
| old | new | Unsafe: old code expects `amountRial` and older intent assumptions. |
| new | old | Unsafe: new code expects `amountToman` and BB-P2 uniqueness/nullable-order semantics. |
| new | new | Required production pair. |

After migration, prefer feature-gate pause and forward-fix. A traditional rollback to the old app is unsafe. A database restore is available only through an incident decision, and before real money it must restore the matching old app/schema pair. After real money, database restore alone is financially incorrect; reconcile external provider truth first.

## Post-deploy health checks

No health check creates a payment or contacts a mutating provider API.

- `/api/health` succeeds.
- Read-only schema query confirms payment columns, constraints, indexes, and migration state.
- A random unknown opaque ID returns a generic not-found response from `/api/payments/{publicPaymentId}`.
- Callback route exists on the platform origin and rejects malformed input without exposing internals.
- Integration resolution, credential-presence checks, and callback derivation pass without logging secrets.
- Operator reconciliation route requires authentication and scopes results to the requested manageable organization.
- Existing PurchaseIntent, Public Catalog, public organization endpoints, operational app/PWA boundaries, cart/checkout, branding, and organization-first routing smoke checks pass.

## Monitoring and alerts

Required dashboards or queries must cover, by organization and without raw PII:

- requests and attempts by state;
- callback received, duplicate, rejected, and failed counts;
- verification start, success, retryable not-found/timeout/provider error, correlation mismatch, and settlement blocked;
- callback-to-verification and verification-to-settlement latency;
- requests pending verification beyond the agreed SLO;
- verified evidence on expired/cancelled requests;
- duplicate/replay/correlation anomalies;
- settlement/audit write failures.

Page an operator for correlation/replay anomalies, late verified money, settlement failure after verified evidence, or a sustained pending-verification backlog. Notify at warning severity for provider timeout/not-found rate or callback latency degradation. Logs must contain only opaque public IDs, hashes, masked mobile values, safe status codes, and counts—never credentials, tokens, raw SOAP, full session IDs, raw mobile numbers, factors, or RRN.

## Durable retry and reconciliation

The application has no approved durable production worker yet. Serverless process memory and `setTimeout` are forbidden as retry mechanisms. The current strict provider query requires callback-supplied session/mobile/factor/RRN evidence, while sensitive values are retained only hashed/masked; a callback-free query cannot be invented by weakening correlation.

Before activation, BB-P4 must establish one of these provider-proven designs:

- documented provider callback retry plus durable idempotent callback ingestion; or
- an encrypted, access-controlled correlation envelope and durable queue/lease worker; or
- another provider-supported query key that uniquely identifies the payment without relaxing exact matching.

Retryable outcomes (`NOT_FOUND`, timeout, transport/provider error, malformed response) remain `PENDING_VERIFICATION` and use bounded exponential backoff with jitter, maximum age, attempt count, lease/claim semantics, and an operator-visible exhausted state. `AMBIGUOUS_MATCH`, correlation mismatch, replay anomalies, and verified money on expired/cancelled requests require manual review. No retry may create another financial settlement.

## Provider callback setup and cutover

The callback is always the stable platform-controlled URL derived from the integration's opaque public ID. It must not use a tenant public host or operational APP host.

If a different callback is currently registered:

1. pause new initiation for that integration;
2. inventory in-flight payments and keep the old callback path operational;
3. register the canonical callback through an authorized provider operator;
4. verify the new route with a provider-approved non-financial check;
5. observe both paths through the maximum provider retry/in-flight window;
6. reconcile every pending payment before retiring the old path;
7. on failure, disable initiation, restore the previous provider callback, and continue safe verification of already-started payments.

## Per-target activation packets

### Bazarbaaz platform

- Canary order: first.
- Existing production integration and genuine CodeName/credential presence must be rechecked at activation time.
- Suitable for the first provider proof because a standalone `PaymentRequest` does not depend on tenant order fulfilment.
- Block until schema/app deployment, durable retry, monitoring, callback authorization, and all manual checkpoints pass.

### Cafe Leo

- Canary order: second, never simultaneous with platform.
- Create and verify exactly one production tenant integration only with owner authorization.
- Confirm the existing dedicated credential profile and genuine CodeName without printing values.
- Keep disabled until platform canary acceptance and Cafe Leo-specific callback/gate checks pass.

### Aka Shoes

- Canary order: third.
- Blocked until the provider/owner supplies and verifies the genuine CodeName and production integration configuration.
- Credentials alone do not make the target ready.

### Italiano 13

- No USSD rollout. Any legacy profile or fixture is drift, not authorization.

## Controlled BB-P4 payment procedure (do not execute in BB-P3)

For one target at a time:

1. verify schema and exact app revision;
2. verify tenant integration, genuine CodeName, credential presence, and canonical callback;
3. prove monitoring and durable reconciliation ownership;
4. enable live verification, then runtime mutation approval, then live payment, while keeping every other tenant's `paymentEnabled=false`;
5. enable only the canary tenant's `paymentEnabled`;
6. create one authorized minimum-value standalone or order-backed request from authoritative server state;
7. perform one authorized real payment;
8. observe callback, exact `GetPayments` match, idempotent settlement, audit, customer status, and—if order-backed—unchanged fulfilment state;
9. repeat the callback/recheck safely and prove no duplicate settlement;
10. accept the canary or immediately pause new initiation.

Success requires exact provider correlation, one settlement, correct Toman/Rial boundary, customer `PAID` only after verification, clean audit/alerts, and zero cross-tenant effect.

## Immediate pause and incident procedure

1. Set the affected integration's `paymentEnabled=false` first. If the incident is broad, also disable `INOTI_ALLOW_LIVE_PAYMENTS` while preserving the controls needed to reconcile already-started payments.
2. Do not blindly disable verification when customers may have paid.
3. Freeze fulfilment decisions based on ambiguous payment state.
4. Inventory `PENDING_VERIFICATION`, late verified, correlation/replay, and settlement-blocked cases through the operator queue.
5. Reconcile provider truth, then choose forward-fix, refund/credit/manual acceptance, or restore under incident command.
6. Re-enable only after a new target preflight and explicit authorization.

## Owner/provider input required before activation

1. Aka Shoes genuine provider CodeName.
2. Authorization to create/verify Cafe Leo's production integration and confirmation that its production credential profile is the intended provider account.
3. Provider-console access or an authorized iNoti operator for callback registration and rollback.
4. Provider evidence for callback retry behavior or a separately approved durable retry/correlation design.
5. Named monitoring/reconciliation owners, alert destinations, pending-verification SLO, and late-payment refund/credit/manual-acceptance authority.
