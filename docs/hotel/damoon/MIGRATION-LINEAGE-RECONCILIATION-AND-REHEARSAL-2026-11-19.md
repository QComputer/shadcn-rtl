# Hotel migration lineage reconciliation and disposable rehearsal evidence — 2026-11-19

Status: `RECONCILED_FOR_DISPOSABLE_REHEARSAL_ONLY` / `PRODUCTION_MIGRATION_NOT_READY`

This record reconciles the five pending Hotel operational/payment migrations against the
sanitized read-only Production preflight evidence in
`PRODUCTION-SCHEMA-PREFLIGHT-2026-11-17.md` (Runflare PostgreSQL, read-only, 2026-11-17,
source baseline `40ebcb7479d82ef56052c02b0a85a1330b98cd7d`; inspected target:
`maindbfsi_db`, org `cmvbltspu0000jt08zfn7xltj` / property `cmvbltsrc0009jt08k3o8jdip`,
observed check-in `14:00` / check-out `11:00`, 0 room/rate/inventory/reservation/hold/guest-request rows).

No Production database, migration ledger, Runflare configuration, deployment, or tenant data
was modified.

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
(Exited 255, `postgres:17-alpine`, unrelated fixture DB/user/volume) — not modified.
Started disposable containers:
- `damoon-migration-gap-rehearsal` (`postgres:17`, healthy, `127.0.0.1:55440->5432`,
  db `damoon_migration_gap_rehearsal`, user `hotel_gap_test`) for CI scripts.
- `damoon-ci-compat-test` (`postgres:17`, `127.0.0.1:55439->5432`, db `retail_hero_test`,
  user `hero_test`) with full `prisma migrate deploy` applied for guarded integration tests.

| Rehearsal | Target | Result | Evidence |
| --- | --- | --- | --- |
| `scripts/hotel/validate-damoon-room-reconciliation.mjs --plan` | manifest only, no writes | **PASS** | 31 unique draft units, `NOT_IMPORTABLE_PENDING_VERIFICATION`, 0 importable records, 4 owner-confirmed suites remain unclassified/provisional, no production/public-booking writes |
| `scripts/db/validate-hotel-migration-gap-upgrade.ts` | pre-20261114130000 checkpoint (120 migrations deployed to disposable DB), seeded existing property rows, then 5 pending migrations + tenant-scoped property service | **PASS** | 5 pending applied in order; existing property/reservation-compatible checkpoint rows preserved; defaults `operationalMode=DISABLED`, `manualConfirmationPolicy=DISABLED`, empty allowed methods, `pendingPaymentMinutes=15`; `HotelManagementService` changed only target `checkOutTime` to `12:00`; cross-tenant update denied without foreign mutation |
| `scripts/db/validate-hotel-production-shape-migrations.ts` | isolated schema shaped from sanitized affected-table Production catalog fixture (not Production data/full lineage), baseline marker + exactly 5 reviewed migrations | **PASS** (assertions) | 5 ordered migrations applied; legacy property/reservation data unchanged, existing bookings receive only NULL `paymentMethod`, public/manual modes remain `DISABLED`, same-tenant quote succeeds, cross-tenant property quote and reservation payment rejected by composite FKs. **Note:** script ended with Windows temp-directory cleanup `EBUSY` after all DB assertions and schema drop completed (exit non-zero due cleanup); no schema/data defect observed. |

CI workflow parity: schema validated/client generated (`pnpm exec prisma validate && prisma generate`).

## 4. Relevant automated checks (disposable/local)

- `node --test tests/damoon-stay-links.test.mjs` — **PASS** (4/4).
- Preserved prototype `sites/damoon/phase1-reservation/guest-request-flow.test.mjs` (from preserved checkout, untracked) — **PASS** (3/3) as isolated artifact; not integrated into shipped Damoon bundle in this PR.
- `pnpm exec tsx --require=./scripts/e2e/register-server-only.cjs --test tests/unit/tenant-capabilities-and-push.test.ts` — **PASS** (36/36 across suites).
- `pnpm exec tsx --require=./scripts/e2e/register-server-only.cjs --test tests/unit/hotel-offline-payment-service.test.ts tests/unit/hotel-offline-receipt-storage.test.ts tests/unit/hotel-public-api-gate.test.ts tests/unit/hotel-management-api-b-contracts.test.ts tests/unit/hotel-management-api-security.test.ts` (subset run) — service/contract/security/public-gate/storage cases **PASS** in-run; several sibling unit suites in the same batch failed only with `TypeError: import_node_test.mock.module is not a function` under Node `v22.18.0` (CI uses Node 24 / compatible test-runner features).
- `tests/integration/hotel-offline-payments.local.test.ts`, `hotel-operational-reservations.local.test.ts`, `hotel-stay-requests.local.test.ts` are guarded DB-acceptance tests requiring specific env/feature flags and dedicated fixture DB identity; not executed as full acceptance in this session (CI-compatible container prepared at 55439 with migrations applied). Existing tenant-context DB integration coverage in repo requires project-specific local DB setup beyond this session.

## 5. Owner decisions / safety boundaries (must remain)

- 31 units (20 rooms, 11 suites); check-in `14:00`; approved check-out `12:00` **pending authorized application** (not applied).
- Unverified physical/details/pricing/publication remain **non-bookable/non-saleable**; draft reconciliation is `NOT_IMPORTABLE_PENDING_VERIFICATION`.
- Tenant boundaries enforced (composite tenant-scoped keys/FKs and service-level denial validated in rehearsals).
- Preserve Restaurant/Cafe behavior and shared auth/tenancy/commerce/media contracts.
- Checksum mismatch / rolled-back rows / ordering anomalies are historical ledger integrity issues, not automatic proof of current schema incompatibility and not safe to erase.

## 6. Production migration readiness

**`PRODUCTION_MIGRATION_NOT_READY`**

Reasons:
1. Production lineage remains unreconciled (27 checksum divergences, 4 rolled-back rows, 13 ordering inversions, 5 pending migrations absent) per preflight; no authorized ledger repair/rewrite performed.
2. Disposable rehearsals cover current-source pre-gap chain and sanitized affected-table production shape only; they do **not** reproduce full Production lineage, all unrelated tables/data, or execution history.
3. No authenticated read-only Production DB/Runflare schema-ledger recheck performed in this session; no Production migration/deploy authorization.
4. Approved check-out change (`12:00`) remains pending authorized tenant-scoped application after schema compatibility and authorization are established.

Passing local rehearsals **does not authorize Production migrations**.
