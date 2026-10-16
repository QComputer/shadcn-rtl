# Production Migration Read-Only Inspection Plan

**Prepared only; not authorized or executed against Production.** The synthetic-only PostgreSQL 17 rehearsal described below is not Production evidence.

## Purpose and package

The package is designed to collect a minimal current snapshot for migration reconciliation:

- `scripts/ops/inspect-production-migration-metadata.mjs` — fixed-query Prisma reader, writes a new JSON file only after all guards pass.
- `scripts/ops/production-migration-readonly-inspection.sql` — psql alternative with explicit target variables and fail-closed transaction/role guards.
- `scripts/ops/production-migration-target.expected.json` — expected Neon project/branch/endpoint/database/host and PostgreSQL major. `readOnlyRole` is deliberately `null` because no permitted least-privilege production role is verified.
- `scripts/ops/test-fixtures/production-migration-target.synthetic.template.json` — local-only target template; the test harness must replace the database suffix with a unique task ID.

The Node reader accepts only an explicit `BB_PRODUCTION_READONLY_URL`; it never reads `.env`, `DATABASE_URL`, or `DIRECT_URL`. Production mode requires `BB_PRODUCTION_READONLY_INSPECTION_APPROVED=YES`, fresh sanitized runtime and Neon attestation files (at most 24 hours old), exact target agreement, a non-null approved role in the target file, and TLS `sslmode=verify-full`. All guards run before Prisma connection. It does not execute migration commands or arbitrary SQL.

## Data collected

Within `SET TRANSACTION READ ONLY`, it confirms database, role/session role, `public` schema, PostgreSQL major, transaction read-only state, and effective privilege limits. It then reads only:

- `_prisma_migrations`: name, checksum, started/finished/rolled-back timestamps and derived status. Migration logs are never selected.
- Public schema structural metadata from PostgreSQL catalogs: columns, constraints, indexes and enum labels. Catalog queries expose schema shape without granting application-table row access; `information_schema.columns` was avoided because visibility can be filtered by table privileges.

It does not select organization rows, customer data, payment rows, token fields, application table values, logs, secrets, or database URLs. It rejects roles that are elevated, inherit another role, can create databases or objects in the target schema, have public-table DML or sequence-write privileges, or can `SELECT` public application tables beyond `_prisma_migrations`. It does not require revoking PostgreSQL's commonly defaulted temporary-object privilege from `PUBLIC`; the only executed transaction is explicitly read-only and the fixed query set creates no objects. It outputs no backend IP address. Prisma raw SQL casts PostgreSQL `name`, `inet`, `regclass`, enum, and related catalog types to supported scalar text/numeric values.

The query scope returns public schema structure broadly so that newly introduced objects can be compared against all migrations. If reviewers require less schema disclosure, replace the broad structural query with a reviewed allowlist generated from the 104 migration SQL files; do not widen table-data access.

## Required Production authorization and access

The owner has authorized this reconciliation mission, including a read-only inspection. That authorization does not establish the active runtime target or create least-privilege access. The role must have only `CONNECT` to the verified database, `USAGE` on `public`, and `SELECT` on `_prisma_migrations`; no application table `SELECT`, DML, sequence access, database/schema create privileges, role membership, or elevated attributes. Catalog visibility must be validated using the actual managed PostgreSQL grants. Do not create or elevate a Production role under this plan.

An operator must provide, through an approved local secret mechanism and never in chat or reports:

1. The explicit read-only connection URL, with TLS verification enabled.
2. A current sanitized Production runtime attestation matching the active deployment and expected Neon project `aged-star-89488704`, branch `br-small-queen-aii58cw9`, endpoint `ep-little-river-aifwxtf7`, database `neondb`, and expected endpoint host.
3. Current Neon endpoint metadata tying endpoint to project/branch.
4. The approved read-only role name and owner approval record.

The expected IDs alone do not prove the connected endpoint. A runtime attestation and independent Neon endpoint mapping must agree. If any field, role privilege, connection state, or TLS check fails, do not inspect ledger/schema and do not retry against another target.

## Reproduction: synthetic-only tests already run

On 2026-10-16, a task-owned PostgreSQL 17 disposable container was published only on a random `127.0.0.1` port, using a uniquely named container and volume and a synthetic database. It contained one fake migration row, an enum, and an `OrganizationBranding` shape. A no-login/low-privilege test role received `CONNECT`, schema `USAGE`, and `SELECT` only on `_prisma_migrations`; `PUBLIC TEMP` was revoked for that synthetic DB.

Results:

- Node inspector: **PASS**; identity checks show PostgreSQL 17, `public`, `transaction_read_only=true`; one synthetic ledger record and schema metadata returned; `noPublicApplicationDataSelect=true`.
- Catalog visibility regression: **PASS**; eight synthetic `OrganizationBranding` columns were visible while the inspection role had no `SELECT` on that application table.
- Wrong database in explicit URL: **PASS, refused before connection**; no output file created.
- Production mode without approved gate and fresh attestations: **PASS, refused before connection**; no output file created.
- psql SQL package: **PASS** on the synthetic fixture; identity/role checks passed and metadata-only sections returned.
- No Production host, URL, credentials, or database were used.

The first local harness attempt had a PowerShell fixture command interpolation error before the read-only role grants; it was corrected without contacting an external service. The final successful tests used a least-privilege synthetic role. The current task-owned synthetic container was stopped after verification; its uniquely named volume and test result files are retained because this mission prohibits destructive cleanup. The latest machine-readable result is `scripts/ops/test-fixtures/inspection-final-v4.88ae9e21a6.json`; earlier intermediate outputs are retained as test traces and are superseded by this result. The container/volume labels and names are recorded in the execution transcript, not embedded as Production evidence.

## Evidence handling and review

Run in a controlled operator shell only after separate authorization. Keep the URL in process-local environment only. Choose a new output filename that does not exist; the program uses exclusive creation. Store output in an approved restricted evidence location, review for expected identifiers and schema metadata, then redact anything not needed before broader sharing. Never attach connection settings, `.env` contents, or raw application data.

The SQL alternative must be invoked with an explicit connection string already validated for target host/database/user and `psql -X -v expected_database=... -v expected_role=... -v expected_postgres_major=17`. It cannot attest Neon project/branch by itself, so do not use it without the same independent runtime and endpoint attestation. Keep `ON_ERROR_STOP` enabled.

**VERIFIED:** synthetic PG17 run, fixed query behavior, default-deny gate, URL target guard, schema-only output, read-only transaction.
**INFERRED:** same tooling can safely collect a future Production snapshot only after an authorized read-only role and fresh identity evidence are supplied.
**BLOCKED:** Production execution; current least-privilege role; fresh Production runtime/Neon endpoint attestations; current Production ledger/schema state; Production-lineage clone.
**NOT CHECKED:** any current Production database or migration record.

## Execution update — 2026-10-16

The linked main checkout's `.env` and `.env.local` were inspected in memory only; credential values were not printed, copied, or used. Their database URL metadata points to the expected pooled/direct Neon host and `neondb`, but the configured role is `neondb_owner` and TLS mode is `sslmode=require`. This is not an approved least-privilege read-only connection, and local dotenv configuration does not attest the active Vercel Production runtime. No database connection was attempted.

The linked Vercel project metadata identifies `shadcn-rtl` (`prj_CVf08NTiNcwtUPHGfGEwfyKHXoZL`, team `team_SXzXqmBelw5uJhsXMckCDajv`). Vercel's environment-variable metadata API returned HTTP 403 for the current integration. The documented CLI fallback `vercel env list production --scope team_SXzXqmBelw5uJhsXMckCDajv --cwd C:\Users\disso\Project\shadcn-rtl` succeeded and exposed only variable names; the configured names include `DATABASE_URL`, `DIRECT_URL`, `POSTGRES_URL`, and `POSTGRES_URL_NON_POOLING`, but no values were requested or read. Names do not prove which endpoint the active deployment uses. The candidate target config still has `readOnlyRole: null`.

The inspector was run with no connection URL and no approval-gate value. It exited 2 with “An approved least-privilege read-only role must be configured; no connection attempted.” No output file was created. This confirms the Production guard fails closed. The exact remaining prerequisite is a currently approved read-only login plus fresh sanitized runtime-deployment and Neon project/branch/endpoint attestations matching the expected target. Do not use the `neondb_owner` URLs as a substitute.
