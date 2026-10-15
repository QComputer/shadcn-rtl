# BB-ORG-P14 — Universal organization provisioning

## Scope and lifecycle

P14 adds a SUPER_ADMIN-only manual provisioning path alongside the existing lead-based tenant-provisioning workflow. A plan moves through `DRAFT` → `READY` → `APPROVED` → `COMPLETED`. The operator creates and configures an execution plan, validates its slug and recipients, then approves the exact validated configuration. Approval stores a canonical SHA-256-bound snapshot. Approved input cannot be changed; a changed request requires a new plan.

Provisioning accepts only active, existing global CUSTOMER accounts with a verified email and current email-verification proof. It creates organization membership invitations for those users; it does not create customer identities or send email/SMS/provider messages. Invitation tokens are returned once to the authorized operator, while the persisted invitation stores a token digest.

Execution runs in one serializable database transaction: organization defaults, selected capability rows, optional hotel property, acquisition metadata, invitations, completed plan receipt, and execution audit record commit together or roll back together. Idempotency keys bind to the actor and payload. A replay returns the prior receipt without reissuing invitation tokens. The receipt records the organization, property, capability set, invitation IDs, public path, and `AWAITING_ADMIN_ACTIVATION`; booking and payments remain disabled.

The shared activation screen now returns every vertical to the ordinary localized dashboard after sign-out and re-login. Hotel members use its authorized Hotel website navigation; non-Hotel members are never directed to a Hotel-only destination. Global accounts stay `CUSTOMER`; ADMIN/MANAGER authority is an organization membership. The inherited conflict policy still rejects an additional privileged membership in another organization; an existing customer-only membership may coexist with the newly activated membership.

If the initial response is lost, reload the completed plan to inspect its durable receipt and invitation states. The token cannot be recovered. Revoke the unclaimed invitation and issue a replacement from this same dashboard; the old token remains unusable. This requires no manual SQL, default password, or external delivery service.

## Registry and capability boundary

Configuration uses the shared `BUSINESS_VERTICALS` taxonomy and `organizationCapabilityKeys` registry. Vertical is independent of enabled capabilities: the service organization may retain a `null` vertical, and a vertical does not implicitly grant its advisory capability suggestions. The legacy plan fields remain mapped for compatibility: `proposedOrganizationType` mirrors the configuration `type`, and `proposedModules` mirrors `enabledCapabilities`; `executionConfiguration` is the canonical P14 input.

P14 allows only these six grants: `SHOP`, `APPOINTMENT`, `CRM`, `LOYALTY`, `IAM`, and `HOTEL_WEBSITE`. `HOTEL_BOOKING`, `SMS`, `USSD`, `ICV`, and `EBC` are outside the allowlist and rejected for both entitlement and enablement. For HOTEL, the configuration must be `SHOP`, include an explicit property, and enable `HOTEL_WEBSITE`. Other verticals cannot carry hotel property configuration or the hotel website capability. Entitlements beyond the explicitly enabled safe set are recorded inactive; only selected enabled capabilities are active.

## Operator UI and API

The localized operator pages are `/{fa|en|ar}/dashboard/tenant-provisioning`, `/new`, and `/{planId}`. They require a SUPER_ADMIN session. The recipient lookup is `GET /api/dashboard/tenant-provisioning-recipients?query=…` and searches only active, verified CUSTOMER accounts.

The API surface is:

- `POST /api/dashboard/tenant-provisioning-plans` with `{ "manual": configuration }` creates a P14 plan; the idempotency key is supplied in the request header.
- `PATCH /api/dashboard/tenant-provisioning-plans/{planId}` with `{ "executionConfiguration": configuration }` configures a draft.
- `POST /api/dashboard/tenant-provisioning-plans/{planId}/validate` and `/approve` validate and bind approval to the exact configuration hash.
- `POST /api/dashboard/tenant-provisioning-plans/{planId}/execute` executes with `{ "approvedSha256": "…" }` and an idempotency key.
- Existing authenticated GET plan-list and plan-detail endpoints expose the plan and receipt to platform operators.

Mutation endpoints enforce same-origin requests and idempotency-key format as applicable. The execution endpoint is platform-only and uses the authenticated session actor rather than trusting actor details from the request body.

## Persistence and release boundary

Migration `20261015190000_universal_provisioning_execution` is the 104th additive migration in this implementation lineage. It adds execution configuration, approved snapshot/hash, receipt, and timestamp columns; unique execution/acquisition keys; and a database guard for immutable approved input, immutable completed plans, and completed-plan receipt requirements. It does not replace or rewrite earlier tenant-provisioning data.

This migration and its verification belong to the isolated local/integration lineage. Production migration status, application, and runtime behavior are separate release evidence and are not asserted by this implementation note.

Before Production use, reconcile the previously reported historical checksum, ordering and branding-migration differences, approve the migration and source release separately, establish verified intended recipients, and choose an authorized token-delivery process. P14 does not create user identities, configure DNS, publish a site, initialize subscription billing, or activate any payment, messaging or hotel-booking provider. Internal public links are references, not publication receipts. Incomplete tenant branding has no platform-logo fallback and remains non-installable under the accepted PWA contract.

The initializer creates ordinary settings and disabled payment settings. It creates appointment settings only when `APPOINTMENT` is explicitly enabled, with automatic confirmation disabled. Hotel properties are created only for HOTEL. Enabled grants carry `enabledAt`; entitled-but-disabled grants carry `disabledAt`. Provider/financial capability approval remains separate from this safe provisioning allowlist.

## Verification evidence

Final guarded run: `f9ed71d41fba`, with durable `.tmp/hotel-secure-onboarding-f9ed71d41fba/result.json`: `status=PASSED`, `exitCode=0`, `cleanup=PASSED`. Docker and host SQL independently verified PostgreSQL 17, database `hotel_onboarding_f9ed71d41fba`, role `hotel_onboarding_test`, public schema, empty schema and absent ledger before migrations. All 104 migration names and SQL checksums matched after execution. The exact task container, volume and assigned port were cleaned up and verified.

| Check | Actual result |
| --- | --- |
| Focused contract, route, persisted-RBAC and DTO unit tests | 42/42, exit 0 |
| P13 readiness compatibility validator | 57/57, exit 0 |
| Prisma generation and schema validation | Passed, Prisma 6.19.3; candidate-owned client |
| Fresh PostgreSQL migration chain | 104/104, successful ledger and checksum checks |
| P14 real PostgreSQL tests | 13/13 |
| Accepted Hotel onboarding real PostgreSQL regressions | 14/14 |
| Shared release-safety real PostgreSQL regressions | 9/9 |
| P14 authenticated production-server Chromium | 8/8 scenarios, synthetic local fixtures |
| Accepted Hotel browser workflow on the same application build | 11/11; `.tmp/hotel-secure-onboarding-b78454b91a42/browser-result.json` |
| Production build, including full TypeScript | Exit 0; `.tmp/p14-production-build-accepted.log` |
| Final standalone full TypeScript | Exit 0; `.tmp/p14-final-typecheck.log` |
| Targeted ESLint | Exit 0; zero errors, three state-in-effect warnings |

The P14 browser result and screenshots are in `.tmp/hotel-secure-onboarding-f9ed71d41fba/`: `p14-browser-result.json`, `p14-wizard-desktop.png`, `p14-wizard-mobile.png`, and `p14b-hotel-dashboard.png`. Tokens are masked in screenshots and redacted from errors; no credentials are included in result files. Expected browser navigation, preload and context-close cancellations are retained in the machine-readable result; they are distinguished from JavaScript errors and unexpected transport failures.

The PostgreSQL suite uses independent connections and an observed row-lock barrier to prove same-key overlap, one organization/receipt/audit, safe replay, direct-SQL approval immutability, authorization revocation before replay, and rollback of every plan stage and execution when audit insertion fails. It retries the identical execution successfully after removal of the synthetic audit failure. The browser covers four configurations, verified-user lookup, real credential sessions, both scoped roles, revoke/reissue and rejection of the old token, wrong-tenant and manager denials, slug collision, durable reload, mobile execution, and English/Arabic direction.

During diagnostic runs, fixture naming, navigation selectors and output-pipe handling defects were corrected rather than reported as application passes. The runner now launches browser children asynchronously so production-server log pipes continue draining. The shared activation screen's Hotel-only re-login destination was generalized; the Hotel regression still verifies actual navigation to its CMS. Application fixes also included the required inactive-capability timestamp and bounded retry of raw-SQL PostgreSQL serialization/deadlock errors wrapped as Prisma P2010. Historical migration SQL was not changed. The new migration is pinned to LF; SHA-256 is `57d8244ab529cf002aa6342cc838cdc7ba62bfb8ffc66c3a0e76f4a17e810065`.

Reproduce the full local acceptance with `node scripts/ops/verify-hotel-onboarding-local.mjs --p14 --security --production-browser` after generating the candidate client and production build. `--p14-browser-only` is an explicit targeted rerun option that reuses earlier accepted Hotel browser evidence; it does not claim that skipped suite ran again. PostgreSQL identities remain generated and guarded. Logs and screenshots are retained locally, not committed as source. No Production database, deployment, provider, DNS, invitation delivery, or remote push was used.
