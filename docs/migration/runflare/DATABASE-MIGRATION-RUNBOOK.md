# Runflare PostgreSQL migration runbook

Status: planning only. This document records a proposed logical migration. No source or target database has been changed by preparing it.

## Decision and evidence boundary

The proposed method is a native PostgreSQL custom-format logical dump from the existing Neon PostgreSQL 17 source and a future restore into the **existing** Runflare PostgreSQL database, followed by catalog, migration-history, application, and transaction checks. Do not use Prisma `db push`, seed, or replay the migration chain as the data-transfer method: the source contains live data and a full historical `_prisma_migrations` ledger, including rows marked rolled back. A logical dump/restore preserves that ledger and all application tables as data while carrying schema objects, constraints, indexes, sequences, enum types, functions, triggers, and table contents. No new database or service is in scope.

Facts confirmed from the checked-out repository and supplied source metadata:

- Repository baseline: `368e545e40cca95ddd9749d42c560d7444b1daa5`.
- Source is PostgreSQL 17.11 on Neon: project `aged-star-89488704`, branch `br-small-queen-aii58cw9`, endpoint `ep-little-river-aifwxtf7`, database `neondb`. The live read-only identity was verified on 2026-10-24.
- The source `_prisma_migrations` ledger has 115 rows: 111 successful, 4 rolled back, and 0 unfinished/failed rows. Preserve every row and its fields; do not replay or reconstruct the ledger.
- The source has 173 tables across `public` (164) and `neon_auth` (9). The full refresh scope includes both schemas and every table unless the owner explicitly revises scope.
- Source extensions are `btree_gist` 1.7 (used by a Hotel GiST exclusion constraint), `pg_session_jwt` 0.5.0, and `plpgsql` 1.0. Target support for `pg_session_jwt` is currently unknown and is a hard blocker for a full restore until verified. Do not silently omit the extension or `neon_auth` objects/data.
- Other captured source settings: PostgreSQL `max_connections=112`, database size 26,845,184 bytes, UTF8, `C.UTF-8`, built-in collation provider `b`, timezone GMT, and default transaction isolation `read committed`. The source metadata and hashes/count fingerprints are in the root-controlled local artifact `runflare-r61-20261024/source-metadata.json`; that artifact is evidence, not a credential source.
- Prisma schema is `prisma/schema.prisma`; the datasource uses `DATABASE_URL` for runtime and `DIRECT_URL` for CLI operations. `prisma.config.ts` also selects `DIRECT_URL` for CLI.
- The app runtime in `lib/db-runtime.ts` creates `PrismaNeon` from `DATABASE_URL` and configures `ws`. A generic Runflare PostgreSQL deployment cannot be assumed to work with this Neon adapter.
- `@prisma/adapter-pg` is already a package dependency. `@prisma/adapter-neon` and `@neondatabase/serverless` are also installed.
- Repository migrations define many PostgreSQL enums and at least a trigger function (`prisma/migrations/20260815000300_inoti_ussd_integration_foundation/migration.sql`). Inventory the complete source catalog; do not infer object inventory from Prisma model counts.
- Application code uses interactive and batch Prisma `$transaction`, `Serializable` and `RepeatableRead` isolation, row locks (`FOR UPDATE`), `SKIP LOCKED`, and `pg_advisory_xact_lock`. These semantics are relied on by checkout, payments, inventory, and job processing.

The intended existing target is **OWNER-CONFIRMED, not yet SQL/provider-verified**: internal host `database-giu-service`, database `databasewhy_db`, administrator `postgres`, PostgreSQL 17.4. This is the only target in scope. It is **not yet verified that this database is empty or compatible**. Before R6.2 considers a restore, perform a read-only inspection against this exact database and confirm identity, primary status, contents, collation, extensions, role capabilities, and pool/direct endpoint details. Any mismatch or nonempty destination blocks restore pending specific owner handling instructions. Do not create another database/service or guess an alternate identity.

## PostgreSQL version and compatibility gate

The source is 17.11 and the existing target is 17.4. PostgreSQL logical dump format is the intended cross-minor transfer mechanism within major version 17, but this target trails the source by seven minor releases and carries a security and bug-fix lag. Ask the owner/provider whether this existing target can be upgraded before migration. Do not create a replacement service/database as a workaround. If it cannot be upgraded, migration requires explicit acceptance of the lag and compatibility verification against this exact target build. Do not treat matching “17” alone as the full compatibility check.

Use PostgreSQL 17 client tools (`pg_dump`, `pg_restore`, `psql`) at least as new as the source (17.11 recommended). Record `pg_dump --version`, `pg_restore --version`, and source/target `server_version_num`; never use an older client to dump a newer server. A logical restore does not copy cluster-wide roles, passwords, tablespaces, server configuration, provider extensions, or external file/blob objects.

## Hard safety gates

This is a future operator procedure, not authorization to execute it. The migration owner must explicitly authorize the exact source and target identities, maintenance window, write pause, backup destination, and migration action before proceeding.

- Keep the source read-only to the migration process. No source DDL/DML, migration, `resolve`, seed, or repair command.
- Verify the exact existing destination identity (`database-giu-service` / `databasewhy_db`) using provider metadata and SQL identity queries in the same authenticated session immediately before any restore. Confirm it is a writable primary and empty. On any mismatch or ambiguity, stop.
- Do not issue `CREATE DATABASE`, `DROP DATABASE`, `DROP SCHEMA`, `--clean`, `--if-exists`, reset, truncate, or cleanup commands under R6.1. A first restore into nonempty `databasewhy_db` is blocked pending specific owner handling instructions; do not clean it or create another database/service. A later R6.4 refresh requires the separately approved target-only replacement procedure below.
- Do not copy Neon system settings or blindly reproduce provider roles. Map ownership and grants to target-supported roles after reviewing the source role/ACL inventory. Never copy passwords or publish credentials.
- Do not dump/restore global role secrets. Do not put connection strings, passwords, PGPASS contents, raw rows, or unredacted verbose logs in shell history, CI output, tickets, or this document. Store connection files in a private operator-only location and redact host/user metadata as required by policy.
- Keep a verified source backup and the custom-format dump immutable and access-controlled. A migration is not complete until restore and application verification succeed and rollback ownership/decision are agreed.
- Preserve `_prisma_migrations` exactly, including every applied, rolled-back, and failed historical row. Do not replay migrations, edit/delete migration rows, or use `migrate resolve` as part of the copy.

## Preflight and inventory (read-only)

Use separately maintained, access-controlled source and target service files (`PGSERVICEFILE`) with TLS verification and private permissions. Avoid inline URLs that may be captured in process arguments. The names below are operator-local aliases, not endpoint facts.

```powershell
$env:PGSERVICEFILE = 'C:\secure\migration\pg_service.conf'
$sourceService = 'verified-neon-source'
$targetService = 'verified-runflare-existing-databasewhy-db'

pg_dump --version
pg_restore --version
psql "service=$sourceService" -X -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), current_setting('server_version'), current_setting('server_version_num'), current_setting('transaction_read_only'); SELECT current_setting('neon.project_id', true), current_setting('neon.branch_id', true), current_setting('neon.endpoint_id', true); ROLLBACK;"
psql "service=$targetService" -X -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), current_setting('server_version'), current_setting('server_version_num'), current_setting('transaction_read_only'), pg_is_in_recovery(); ROLLBACK;"
```

The target query above only observes identity. It must connect to the exact existing `databasewhy_db` on the owner-identified internal service, not a newly provisioned target. A read-only emptiness check must enumerate schemas/relations, rows, extensions, and existing user objects; do not use row counts alone. R6.1 authorizes no restore writes. A future authorized restore also needs a verified target backup and an explicit target-replacement authorization if the database contains any data or objects. Require `pg_is_in_recovery() = false` for target. Confirm source values against the live Neon ledger evidence. Do not expose connection binding values.

Before backup, capture a read-only inventory from both schemas/databases and save it as protected migration evidence:

- database encoding, collation, character classification, locale provider, ICU locale/rules, and default tablespace;
- extensions with versions and schemas, explicitly including `btree_gist`, `pg_session_jwt`, and `plpgsql`; schemas including `neon_auth`; enum/domain/composite types; sequences and ownership; functions/procedures and language; triggers; views/materialized views; indexes; constraints including FK deferrability/validation; policies; publications/subscriptions if any;
- table and partition inventories, approximate and exact row counts as practical, including every application table and `_prisma_migrations` (do not rely on counts alone);
- role ownership and grants/ACLs for database, schema, tables, sequences, functions, and default privileges, sanitized to role names; identify any source owner that cannot exist on Runflare;
- migration ledger ordered by `migration_name`, including checksum, `finished_at`, `rolled_back_at`, `applied_steps_count`, and active failed rows. Compare the full list and checksum values to repository migrations without changing either side;
- relevant data invariants: foreign-key anti-joins/validation, unique-key violations, nullability, sequence values above table maxima, ledger relationships, and domain-specific order/payment/inventory/audit history checks agreed by the application owner.

Collation/provider differences can change ordering, uniqueness, case behavior, and index validity even with identical encoding. If target collation or required extensions differ, stop for explicit compatibility analysis; do not silently accept a restore warning.

## Backup and restore rehearsal

R6.4 full refresh of the rehearsal data in existing `databasewhy_db` requires separate explicit owner authorization to replace this exact target and a verified target-only backup first. Without both, refresh is **BLOCKED**. Do not create a new database/service as an alternative. The approved target-only replacement procedure must inventory the archive and existing objects, fence target traffic, preserve its backup, remove/replace only the approved rehearsal objects with the provider-supported method, restore the final complete archive, and verify every invariant before opening writes. Commands for that consequential replacement must be reviewed against the then-current target inventory, not inferred from this first-empty-target restore command. Source remains untouched; no silent overwrite or partial retry is allowed. Obtain a source-wide write freeze for final cutover; an online dump alone omits later writes.

For the approved cutover, pause application writes and background workers through their supported operational controls, drain in-flight requests/transactions, then create a custom-format archive. Ensure the output directory is private and has adequate space. `pg_dump` is read-only against its source, but its output contains production data.

```powershell
$archive = 'D:\protected-migration\bazarbaaz-source-17.dump'
pg_dump "service=$sourceService" --format=custom --verbose --file=$archive
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed; do not restore this archive.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $archive
```

Use a versioned, access-controlled secret store for the hash and backup metadata. Do not send `--verbose` output to shared logs; capture it only in a restricted log and redact connection data. The dump must include the full database schema and data, including `_prisma_migrations`; do not use table/schema exclusions or `--data-only`/`--schema-only`. Keep the source database name and dump filename distinct from destination names to prevent accidental source targeting.

Before restore, inspect the archive TOC without connecting to a destination and reconcile it with the source inventory:

```powershell
pg_restore --list $archive | Out-File -Encoding utf8 'D:\protected-migration\archive-toc.txt'
if ($LASTEXITCODE -ne 0) { throw 'Archive TOC validation failed.' }
```

After R62 has confirmed the exact existing target identity and emptiness, and after all required target-write/replacement/backup authorizations are present, reverify identity and empty state immediately before the first write. Do not run `createdb`, and do not use `--clean`. The example maps restored objects to the provider-confirmed target owner role; it suppresses source ACLs/owners because source roles are not portable. Apply the reviewed target grant plan separately after restore. Any nonempty target remains a hard stop unless the owner separately authorizes its exact handling.

```powershell
pg_restore --verbose --exit-on-error --no-owner --no-acl --role=$targetOwnerRole --dbname="service=$targetService" $archive
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; freeze destination access and follow the approved recovery decision. Do not clean or retry over this database.' }
```

`$targetOwnerRole` is `postgres` only if the provider confirms that this role is valid and sufficient on the existing target. A failed/partial restore is not repaired by dropping objects. Preserve the target and report the failure; do not retry over it or use a different database/service. Any recovery requires explicit owner handling instructions and a fresh target identity/backup/authorization review. If preserving original object ownership is a hard requirement, first arrange equivalent target roles and validate role ownership restoration in rehearsal; never import source role credentials.

## Post-restore checks (read-only unless explicitly labeled)

Keep app traffic and workers paused until these checks pass. Compare source and target using captured evidence; counts are supporting evidence, never the sole acceptance test.

1. Reconfirm provider destination identity and server version; verify target remains primary and TLS is active.
2. Compare encoding/collation/locale, schemas (including `neon_auth`), extensions and versions, all 173 relations/partitions, enum/domain definitions, sequences, constraints, indexes, functions, triggers, views, and ownership/grants against source inventory. `pg_session_jwt` availability is an explicit pre-restore gate. Resolve every restore warning; require all expected extension versions and valid/validated constraints and indexes.
3. Compare the complete `_prisma_migrations` ledger, including checksums and rolled-back history, byte-for-byte at the field level. Verify no active failed migration is newly introduced and no historical row disappeared or changed.
4. Compare exact counts where practical and table fingerprints/checksums for critical business tables using a deterministic, documented canonical projection (primary key sorted; stable serialization of nulls, timestamps, decimals, JSON and byte values). Reconcile any differences. Validate foreign-key anti-joins, unique constraints, sequences, financial/order/inventory ledgers, audit history, and sample tenant-isolation relationships.
5. Run a read-only Prisma schema/runtime connectivity check with the target direct URL and the intended runtime adapter. Do not run migrations or seeds. Exercise application smoke/acceptance against a protected staging deployment and synthetic/approved accounts before cutover.
6. Verify real transaction behavior on an authorized test target: interactive and batch transactions, rollback, `Serializable` conflict handling/retry, `RepeatableRead`, `FOR UPDATE`, `SKIP LOCKED`, and `pg_advisory_xact_lock`. Confirm connection pool sizing/timeouts and that transaction-scoped locks remain on one connection. Size connections so `app instances × per-instance pool + admin + backup + reserved headroom < target max_connections`; target max connections must be measured before setting the pool. Five connections per app instance is only an unmeasured starting hypothesis, not an approved setting.
7. Reconcile target grants for the app role (connect, schema usage, required table/sequence/function privileges) and migration operator role separately. The app must not use an owner/superuser identity.
8. Retain the source untouched and available through the agreed rollback window. Cut over app secrets only after acceptance and explicit release approval; keep the old source runtime configuration available in the secret manager for rollback, never in repository files.

## Application connection change required

`lib/db-runtime.ts` currently instantiates `PrismaNeon` directly using `DATABASE_URL`. The target Runflare connection may be a normal PostgreSQL TCP endpoint. Implement and review a provider/runtime-selectable adapter path before cutover, retaining Neon for the current source as needed and using `PrismaPg` from the already-installed `@prisma/adapter-pg` for standard PostgreSQL. Keep a single exported `PrismaClient`, the existing dev singleton behavior, error-only production logs, and hermetic local test path. Avoid provider inference from a URL string alone; use explicit validated runtime configuration.

Maintain separate meanings for:

- `DATABASE_URL`: application runtime connection. Use a pooled URL only if the provider confirms PgBouncer/transaction-pooling compatibility with this Prisma driver and the app’s transaction patterns; otherwise use an approved direct/session endpoint with bounded pool settings.
- `DIRECT_URL`: direct PostgreSQL endpoint used by Prisma CLI/migrations and admin inspection. Do not send migration/restore traffic through a transaction pooler.

Before release, verify URL options, TLS certificate verification (`sslmode=verify-full` or provider-documented equivalent), CA trust, connection limits, idle/connect/statement/transaction timeouts, IPv4/IPv6 reachability, serverless connection lifecycle, and provider pool semantics. Never log a URL. Test the adapter against the actual provider using rollback-only and read-only probes first, then disposable integration coverage. Migration execution remains a separate change and authorization after the data copy.

## Rollback and abort rules

If any identity, inventory, archive, restore, fingerprint, extension, collation, ledger, FK, role, or transaction check fails: keep traffic paused, stop, preserve artifacts/logs securely, and report the exact sanitized failure. Do not attempt a destructive repair or reuse the failed destination. R6.1 performs read-only metadata queries and no restore writes, migrations or app cutover. The rollback decision is to resume the untouched source only after confirming source health and reverting any separately approved application connection change. No source database deletion, branch deletion, target reset, new database/service, or cleanup is part of this runbook.

## Repository references

- Schema and URL roles: `prisma/schema.prisma`, `prisma.config.ts`.
- Runtime adapter: `lib/db-runtime.ts`, with boundary/re-export in `lib/db.ts`.
- Runtime validation/reporting: `docs/database/NEON_SERVERLESS_RUNTIME_ARCHITECTURE.md`, `docs/database/NEON_RUNTIME_VALIDATION_REPORT.md`, `docs/database/NEON_PRISMA_6_ADAPTER_MIGRATION.md`.
- Migration CLI policy/history: `docs/database/NEON_MIGRATION_AND_CLI_POLICY.md`, `docs/database/DATABASE_MIGRATION_CHAIN_RECOVERY.md`, `prisma/migrations/`.
- Existing migration scripts include `scripts/db/validate-migration-chain.mjs` and `scripts/quality/validate-database-migration-chain.mts`; inspect scripts before use because they are not a cross-provider data-transfer procedure.
- Operational migration scripts under `scripts/ops/` are purpose-specific and are not a substitute for the full logical backup/restore above.
