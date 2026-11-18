# Hotel migration lineage reconciliation and disposable rehearsal evidence - 2026-11-19

Status: `RECONCILED_FOR_DISPOSABLE_REHEARSAL_ONLY` / `PRODUCTION_MIGRATION_NOT_READY`

This record reconciles the five pending Hotel operational/payment migrations against the
sanitized read-only Production preflight evidence in
`PRODUCTION-SCHEMA-PREFLIGHT-2026-11-17.md` (Runflare PostgreSQL, read-only, 2026-11-17,
source baseline `40ebcb7479d82ef56052c02b0a85a1330b98cd7d`; inspected target:
`maindbfsi_db`, org `cmvbltspu0000jt08zfn7xltj` / property `cmvbltsrc0009jt08k3o8jdip`,
observed check-in `14:00` / check-out `11:00`, 0 room/rate/inventory/reservation/hold/guest-request rows).

No Production database, migration ledger, Runflare configuration, deployment, or tenant data
was modified. No PR merge, deploy, Production migration, or real booking creation was performed.

## 1. Pending migrations (current source / `origin/main` lineage)

All five are absent from the Production ledger per preflight and are additive (no `DROP`,
`TRUNCATE`, or data deletion). Repository sequence and required execution order:

| Order | Migration | Adds / depends on | Preflight state |
| --- | --- | --- | --- |
| 1 | `20261114130000_hotel_operational_modes_and_stay_requests` | `HotelOperationalMode`, `HotelStayRequestStatus`; `HotelProperty.operationalMode` (default `DISABLED`); `HotelStayQuote`, `HotelStayRequest` with tenant-scoped FKs to existing `HotelProperty(id,organizationId)` | absent objects/types/columns/tables |
| 2 | `20261114140000_hotel_offline_payments` | `HotelOfflinePaymentMethod/Status/CommandType`; `HotelOfflinePayment`, `HotelOfflinePaymentCommandIdempotency`; tenant-scoped FK to existing `HotelReservation(id,organizationId)`; amount/status/check constraints | absent |
| 3 | `20261114150000_hotel_reservation_payment_policy` | depends on step 2 enums/table; `HotelManualConfirmationPolicy`; property policy columns/defaults/constraint; nullable `HotelReservation.paymentMethod`; `HotelOfflinePayment.receiptKey` | absent |
| 4 | `20261114160000_hotel_pending_payment_deadline` | `HotelProperty.pendingPaymentMinutes` (default 15) + range constraint; ordered after step 3 in repo sequence | absent |
| 5 | `20261114170000_hotel_offline_payment_audit` | extends step 2 `HotelOfflinePaymentCommandType`; `HotelOfflinePaymentAuditEventType`; append-only `HotelOfflinePaymentAuditEvent` referencing step 2 ledger with tenant FK | absent |

Hard dependencies: **13 before request/quote use on property**, **14 before 15 and 17**,
**15 before 16 only by repository ordering** (16 adds an independent property column).
Do not apply any later migration while a prerequisite enum/table is absent. No partial
application of these five was observed in preflight.

## 2. Historical ledger integrity (distinct from pending-schema compatibility)

Preflight observed 124 Production rows / 120 distinct completed source names, 4 rolled-back rows,
0 unfinished non-rolled-back rows, and 5 source migrations missing from ledger. **27 completed
migrations have checksums differing from `origin/main` SQL** (export-hub/integration/runtime/
identity/demo/catalog/entity/seo/acquisition/activation/trust/workspace/growth/iNoti runtime +
platform owner/branding/public-home/payment money semantics/iNoti payment E2E/tenant branding
extensions/durable payment reconciliation; exact SHA-256 pairs recorded in preflight).
**4 rolled-back rows** across `20260628000100_import_hub_foundation`,
`20260703000100_add_creative_studio_asset_rolled_back`, and
`20260824000100_ussd_event_observability` (two rolled-back + one completed). **13 successful
ordering inversions** were recorded from finished-at ordering (AI-media preference/delivery chain,
creative/request-demo/export ordering, and `20260831000100` completing before
`20260830000300_tenant_branding_extensions`).

These are historical migration-ledger integrity/lineage issues. They are **not** evidence that
the current schema is incompatible with the five pending additive migrations, but they **do**
block treating a fresh/current-chain rehearsal as proof of Production safety. Ledger rows,
historical SQL, and Production history must not be rewritten/hidden; `prisma migrate resolve`
or manual ledger edits are not authorized by this record.

## 3. Disposable PostgreSQL rehearsals executed (2026-11-19, loopback only)

Environment: Docker Desktop accessible (`docker info` server `29.7.2`), Node `v22.18.0`,
pnpm `10.15.0`. Port `55439` was occupied by stopped container `bazarbaaz-admin-20261103`
(Exited 255, `postgres:17-alpine`, unrelated fixture DB/user/volume) - inspected only, not modified.
Started disposable containers:
- `damoon-migration-gap-rehearsal` (`postgres:17`, healthy, `127.0.0.1:55440->5432`,
  db `damoon_migration_gap_rehearsal`, user `hotel_gap_test`) for CI-style rehearsal scripts.
- temporary `damoon-ci-compat-test` (`postgres:17`, `127.0.0.1:55439->5432`, db `retail_hero_test`,
  user `hero_test`) with full `prisma migrate deploy` applied for guarded integration fixture identity.
  All session-created disposables were stopped/removed after use.

| Rehearsal | Target | Result | Evidence |
| --- | --- | --- | --- |
| `node scripts/hotel/validate-damoon-room-reconciliation.mjs --plan` | manifest only, no writes | **PASS** | 31 unique draft units, `NOT_IMPORTABLE_PENDING_VERIFICATION`, 0 importable records, 4 owner-confirmed suites remain unclassified/provisional, no production/public-booking writes |
| `scripts/db/validate-hotel-migration-gap-upgrade.ts` | pre-20261114130000 checkpoint (120 migrations deployed to disposable DB), seeded existing property rows, then 5 pending migrations + tenant-scoped property service | **PASS** | 5 pending applied in order; existing property/reservation-compatible checkpoint rows preserved; defaults `operationalMode=DISABLED`, `manualConfirmationPolicy=DISABLED`, empty allowed methods, `pendingPaymentMinutes=15`; `HotelManagementService` changed only target `checkOutTime` to `12:00`; cross-tenant update denied without foreign mutation |
| `scripts/db/validate-hotel-production-shape-migrations.ts` | isolated schema shaped from sanitized affected-table Production catalog fixture (not Production data/full lineage), baseline marker + exactly 5 reviewed migrations | **PASS** (assertions) | 5 ordered migrations applied; legacy property/reservation data unchanged, existing bookings receive only NULL `paymentMethod`, public/manual modes remain `DISABLED`, same-tenant quote succeeds, cross-tenant property quote and reservation payment rejected by composite FKs. |

CI workflow parity: schema validated/client generated (`pnpm exec prisma validate && prisma generate`).

### 3.1 Production-shape rehearsal cleanup/warning semantics (corrected)

- **Final local rerun (after hardening):** `node ./node_modules/tsx/dist/cli.mjs scripts/db/validate-hotel-production-shape-migrations.ts` against disposable loopback PostgreSQL `127.0.0.1:55439`, db `damoon_migration_gap_rehearsal`, schema `damoon_production_shape_rehearsal` - **PASS** (exit 0). Prisma `migrate resolve --applied 20261114120000_production_shape_fixture_baseline` and `migrate deploy` applied exactly the 5 pending migrations in order; all DB assertions passed; final logs: `PASS: exactly five ordered migrations apply...`, `PASS: legacy property and reservation data persist...`, `PASS: same-tenant quote succeeds...`; no cleanup warning emitted.
- **Prior intermediate Windows run:** the same script reached all DB assertions and dropped the isolated schema, but a post-assertion temporary-directory removal hit transient Windows `EBUSY`; that intermediate run produced a non-zero exit due cleanup only. This was a script-cleanup issue, **not** a schema/data migration failure.
- **Script hardening (this PR):** `scripts/db/validate-hotel-production-shape-migrations.ts` now sets `assertionsPassed = true` only after all assertions and PASS logs complete. Temp-dir cleanup retries remain best-effort after DB assertions/schema drop; if cleanup is skipped it now warns conditionally (`... after successful assertions: ...` only when `assertionsPassed` is true, otherwise `... after rehearsal did not complete successfully: ...`). The script never prints PASS assertions logs unless that pass block is reached.
- **GitHub Actions evidence (exact PR99 head `16dba1cc191af1ec8ce11c6702832c2cc59584ff`):** `Hotel Production-Gap Upgrade Rehearsal` - SUCCESS; `RunFlare TypeScript` - SUCCESS. Vercel deployment failure on that head was non-required; `mergeStateStatus` UNSTABLE. (Updated-head CI for later backend commits must be recorded separately.)

## 4. Relevant automated checks

### 4.1 Node 24 (`v24.13.1`, `C:\Users\disso\AppData\Local\nvm\v24.13.1\node.exe`) - schema/readiness and previously blocked `mock.module` suites

All run with `DATABASE_URL=postgresql://hero_test:local_admin_fixture_only@127.0.0.1:55439/retail_hero_test`, `DATABASE_RUNTIME_ADAPTER=postgresql`, `NODE_ENV=test` (tests use injected/mocked DB where applicable).

| Suite(s) | Command / mode | Result |
| --- | --- | --- |
| `tests/unit/hotel-stay-requests-contract.test.ts`, `tests/unit/hotel-stay-request-schema-gate.test.ts`, `tests/unit/hotel-operational-schema-gate.test.ts` | `node ./node_modules/tsx/dist/cli.mjs --require=./scripts/e2e/register-server-only.cjs --test ...` | **PASS** (5/5). New schema-gate tests prove fail-closed 503 before incompatible `operationalMode`/payment-policy/stay-request writes/queries when schema is absent and confirm feature-flag gating does not require pending schema reads. |
| `tests/unit/hotel-guest-request-routes.test.ts`, `tests/unit/hotel-guest-booking-requests.test.ts` | `node --experimental-test-module-mocks --require ./scripts/e2e/register-server-only.cjs --import tsx --test ...` | **PASS** (9/9). |
| `tests/unit/hotel-anonymous-hold-enabled-route.test.ts`, `hotel-guest-reservations-route.test.ts`, `hotel-inventory-idempotency-handler.test.ts`, `hotel-management-api-adapter.test.ts` | same Node 24 `mock.module` mode | **12 pass / 4 fail**. 4 failures are in `hotel-guest-reservations-route.test.ts` only: route now performs fail-closed operational schema readiness check in `guestScope()` (503) before auth/property-lookup behaviors those tests expected; failures are due the intentional pre-migration compatibility gate, not runner incompatibility. |
| `tests/unit/hotel-management-api-b-handlers.test.ts`, `hotel-management-api-handlers.test.ts`, `hotel-offline-payment-route.test.ts`, `hotel-offline-receipt-route.test.ts` | same | **PASS** (22/22). |
| `tests/unit/hotel-public-catalog-routes.test.ts`, `hotel-public-routes-success.test.ts`, `hotel-website-management-route.test.ts`, `hotel-website-public-routes.test.ts` | same | **PASS** (14/14). |

**Previously blocked `mock.module` unit suites on Node 22:** now executed on Node 24 as above. The earlier Node 22 `TypeError: import_node_test.mock.module is not a function` failures were runner/runtime compatibility (Node 22 lacked the needed test-runner `mock.module` behavior in this invocation context), not established product defects. Remaining `hotel-guest-reservations-route.test.ts` expectation mismatches are test-contract updates needed for the added fail-closed schema gate (intentional).

### 4.2 Earlier Node 22/local checks (still relevant)

- `node --test tests/damoon-stay-links.test.mjs` - **PASS** (4/4).
- Preserved prototype `sites/damoon/phase1-reservation/guest-request-flow.test.mjs` - **PASS** (3/3) as isolated artifact; not integrated into shipped Damoon bundle.
- `pnpm exec tsx --require=./scripts/e2e/register-server-only.cjs --test tests/unit/tenant-capabilities-and-push.test.ts` - **PASS** (36/36).
- Focused no-`mock.module` hotel subset (`hotel-offline-payment-service`, `hotel-offline-receipt-storage`, `hotel-public-api-gate`, `hotel-management-api-b-contracts`, `hotel-management-api-security`) - **PASS** (20/20).

### 4.3 Guarded DB integration suites (disposable PostgreSQL)

Fixture prepared: disposable `postgres:17` container `damoon-pr99-fixture-55439` at `127.0.0.1:55439` (`retail_hero_test` / `hero_test` / `local_admin_fixture_only`), full `prisma migrate deploy` applied (all migrations including the 5 pending Hotel migrations). Guarded suite execution was not fully completed in this environment session (container/fixture lifecycle and suite runtimes require careful guarded execution); no passed claim is made without captured output. Suites to run with their documented guards: `HOTEL_OFFLINE_PAYMENT_PG_ACCEPTANCE=1` (`hotel-offline-payments.local.test.ts`), `HOTEL_OPERATIONAL_RESERVATION_ACCEPTANCE=1` (`hotel-operational-reservations.local.test.ts`), `HOTEL_STAY_REQUEST_ACCEPTANCE=1` (`hotel-stay-requests.local.test.ts`) against the guarded loopback fixture. PR55 stay-request integration tests were copied into PR99 for reusable coverage.

## 5. Schema-readiness / feature-gate hardening added in this PR

- `lib/hotel/services/booking-context.ts`: `authorizeHotelBookingActor` now selects only base `HotelProperty` fields (`HOTEL_BOOKING_BASE_PROPERTY_SELECT`) so authorization does not read `operationalMode`/payment-policy columns before migration 13/15/16.
- `lib/hotel/services/booking-quote.ts`: pricing accepts base pricing property fields (`id/organizationId/currency/timezone/minStayNights/maxStayNights`) instead of requiring full Prisma `HotelProperty` with pending columns.
- `lib/hotel/services/hotel-schema-readiness.ts`: fail-closed checks for stay-request schema (migration 13: `HotelProperty.operationalMode`, `HotelStayQuote`, `HotelStayRequest`) and operational-reservation schema (migrations 13-17 fields/tables including offline-payment/audit tables). Missing schema or `P2021`/`P2022` conditions return **503** ("... not available until pending Hotel migrations are applied"); feature flags/default-disabled behavior remains authoritative.
- `lib/hotel/services/hotel-stay-request.service.ts`: explicit schema readiness checks in `configure`/authorize/read/transaction before any `operationalMode`, `hotelStayQuote`, or `hotelStayRequest` access; base property selects used for pricing/context. Operational activation remains default-disabled by flags/property mode.
- `lib/hotel/services/hotel-operational-reservation.service.ts`: explicit schema readiness checks in `configure`, `authorize`, and transaction `execute` before payment-policy/operational fields and stay-quote/request use; base+operational selects only after readiness passes.
- `app/api/hotel/v1/guest-reservations/route.ts`: fail-closed schema readiness check before tenant-resolved guest operational reads/writes (feature flags still required).
- `app/api/organizations/[id]/hotels/[propertyId]/stay-requests/route.ts`: org-scoped authenticated stay-request GET/POST/PATCH route reusing `HotelStayRequestService` (PR55 vertical-slice shape) with same-origin/idempotency handling.
- Public `HotelGuestBookingRequest` flow (`lib/hotel/guest-booking-request.server.ts`, `app/api/hotel/v1/requests/*`) remains separate from authenticated `HotelStayRequest` (`hotelStayQuote`/`hotelStayRequest` models) and was not conflated.

## 6. Owner decisions / safety boundaries (must remain)

- 31 units (20 rooms, 11 suites); check-in `14:00`; approved check-out `12:00` **pending authorized application** (not applied).
- Unverified physical/details/pricing/publication remain **non-bookable/non-saleable**; draft reconciliation is `NOT_IMPORTABLE_PENDING_VERIFICATION`.
- Tenant boundaries enforced (composite tenant-scoped keys/FKs and service-level denial validated in rehearsals; guarded DB integration coverage remains to be captured on exact updated head).
- Preserve Restaurant/Cafe behavior and shared auth/tenancy/commerce/media contracts.
- Checksum mismatch / rolled-back rows / ordering anomalies are historical ledger integrity issues, not automatic proof of current schema incompatibility and not safe to erase.

## 7. Production migration readiness

**`PRODUCTION_MIGRATION_NOT_READY`**

Reasons:
1. Production lineage remains unreconciled (27 checksum divergences, 4 rolled-back rows, 13 ordering inversions, 5 pending migrations absent) per preflight; no authorized ledger repair/rewrite performed.
2. Disposable rehearsals cover current-source pre-gap chain and sanitized affected-table production shape only; they do **not** reproduce full Production lineage, all unrelated tables/data, or execution history.
3. No authenticated read-only Production DB/Runflare schema-ledger recheck performed in this session; no Production migration/deploy authorization.
4. Approved check-out change (`12:00`) remains pending authorized tenant-scoped application after schema compatibility and authorization are established.
5. Guarded DB integration suite outputs for the updated backend head (offline payments, operational reservations, stay requests) must be captured and attached to the updated PR before claiming full guarded integration acceptance.

Passing local rehearsals and unit/schema-gate checks **does not authorize Production migrations**.