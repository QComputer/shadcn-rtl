# R6 Runflare Acceptance Checklist

**Status: R6.1 evidence checks plus pending R6.2–R6.4 gates.** Baseline `368e545e40cca95ddd9749d42c560d7444b1daa5`. Checked R6.1 items refer only to the recorded read-only evidence; later-phase boxes remain pending. Label evidence as source-confirmed, root-observed, isolated-host, or Production; do not substitute one category for another.

## R6.1 — Evidence, scope and publication boundary

- [x] Record current source commit and verify it is exactly the agreed baseline for this planning cycle.
- [x] Fresh Vercel metadata confirms Production `dpl_4Gfqhn9n6o4mpGt6bcpTYTjUqw6e` READY at this baseline, with 13 aliases; recheck before any future release.
- [x] Preserve fresh read-only source SQL evidence (2026-10-24): source PostgreSQL 17.11; Neon project `aged-star-89488704`, branch `br-small-queen-aii58cw9`, endpoint `ep-little-river-aifwxtf7`, database `neondb`; SQL database size `26,845,184` bytes; 112 max connections; C.UTF-8, builtin collation provider `b`, version 1; 173 tables (164 `public`, 9 `neon_auth`); migration ledger 115 rows (111 successful, 4 rolled back, 0 unfinished). Also record root-reported proxy port 10808, 21,600-second retention and logical replication disabled. These do not prove restoreability or target emptiness.
- [x] Retain the sanitized source SQL identity, catalog, ledger and table-count/fingerprint capture at the artifact path in the audit. Recheck at R6.2/R6.4. Target emptiness and restoreability remain **UNKNOWN**.
- [x] Record later RunFlare console navigation failure separately from the earlier UI observation that Auto Pull on `main` was enabled. Auto Pull was not changed. Recheck through supported console access before future changes.
- [x] Owner authorized exactly one false `git.deploymentEnabled` entry for `codex/bb-r6-1-runflare-readiness`; configuration comparison verifies all inherited settings and main remain unchanged. Push/PR are permitted under that suppression, not deployment or merge. No `[skip vercel]` shortcut is assumed.
- [ ] After publication, verify zero Vercel deployments for the branch/commit and unchanged current Production. Record fresh metadata in the PR/release evidence; do not turn this into a deployment smoke test.
- [ ] Confirm no R6.1 production migration, deployment, disk change, media copy/delete, DNS/environment mutation or live provider send occurred.
- [x] Review all nine documents: this checklist plus `R6-1-READINESS-AUDIT.md`, `ENVIRONMENT-MAPPING.md`, `DATABASE-MIGRATION-RUNBOOK.md`, `MEDIA-MIGRATION-RUNBOOK.md`, `RUNFLARE-DEPLOYMENT-PLAN.md`, `DOMAIN-CUTOVER-PLAN.md`, `R6-RISK-REGISTER.md`, `R6-EXECUTION-ROADMAP.md`.

**R6.1 exit:** deliver the nine-document evidence package and deployment-suppressed review PR. Owner/operator assignments, target/extension decisions and later-phase authorization are recorded prerequisites for R6.2, not silently executed here. “RunFlare production ready” is not an R6.1 outcome.

## R6.2 — Isolated database/runtime/storage implementation

**Authorization and target control**

- [ ] Obtain written phase authorization naming source identity/snapshot, existing target service `database-giu-service` and existing database `databasewhy_db` (owner `postgres`, reported PostgreSQL 17.4), use of the existing app service if safely isolatable, approved test data, operators, time window and retention owner. No new DBs or duplicate services are in scope.
- [ ] Verify target identity using provider control-plane evidence and read-only SQL in the intended session immediately before a write. Confirm database/service, server version, role, TLS, primary status and permissions.
- [ ] Prove identity and whether existing `databasewhy_db` contains any objects. Restore into this DB only if empty and separately approved. If it is non-empty, identity is ambiguous, or emptiness cannot be established, **STOP**. Do not drop, clean, truncate, reset, overwrite or create another DB/service as a workaround.
- [ ] Gather current source/target catalog evidence, role/ACL/extension/collation information, constraints/index/function/trigger inventory, critical row counts/invariants and complete `_prisma_migrations` ledger/checksums including rolled-back/failed history. Verify required `btree_gist` 1.7 and Hotel exclusion constraint. Resolve `pg_session_jwt` 0.5.0 and nine `neon_auth` tables/schema portability before full restore; do not silently omit/filter provider objects or libraries.
- [ ] Verify source identity against Neon project/branch/endpoint evidence and agree a consistent snapshot. Protect source credentials and all query output.
- [ ] Rehearse custom-format full logical dump/restore only on an already-existing, separately approved isolated database resource. None is identified in this R6.1 scope. If unavailable, stop restore rehearsal rather than creating another database/service. Use PostgreSQL 17 clients at least as new as source; validate hash/TOC and warnings. Preserve source unchanged.
- [ ] Confirm independent protected database backup outside the RunFlare target disk. Rehearse only on an already-existing, separately approved isolated DB; do not create a DB/service. Do not treat the six-hour Neon retention window as independent backup evidence.

**Application runtime**

- [ ] Implement and review PrismaPg through installed `@prisma/adapter-pg`; confirm runtime `DATABASE_URL` and direct maintenance `DIRECT_URL` are separate secret-store entries with least-privileged roles.
- [ ] Keep all migrations out of app startup. Compare target `_prisma_migrations` with source; no replay, `db push`, seed, `resolve` or ledger repair as part of data transfer.
- [ ] Validate actual PostgreSQL 17 behavior for bounded connection pools, transactions, `Serializable`/`RepeatableRead`, row locks, `SKIP LOCKED`, advisory locks, timeout and connection release under cancellation/restart.
- [ ] Prove frozen-lockfile install/build and production start on the exact Node 24 target. Record package manager choice because repo pins pnpm 10.15.0 while console reports npm 11.6.0. Capture service memory/CPU/disk, build location, startup, health, graceful stop and restart; do not assume 2 GB base storage is persistent.
- [ ] Inspect production artifact contents and secret scan result. Exclude `.git`, `.env*`, private configuration, database dumps/backups, `node_modules`, build output and local evidence. Never publish raw credentials or row data.

**Storage and existing application service**

- [ ] Complete two-way metadata reconciliation of stored objects and every live database reference family, including tenant, purpose, public/private access, URL/key aliases and unresolved/unknown classes. Keep object bytes unread unless a separately approved copy phase permits it.
- [ ] Decide object storage vs production disk adapter. For `/disk/media`, prove mount path, process permissions, path traversal/symlink defenses, persistence across restart/redeploy, replica visibility, quota/free space, alarms, independent backup and restore before writes. `MEDIA_STORAGE_ROOT` is not implemented in baseline.
- [ ] Preserve legacy `/uploads`/Blob URLs and product/gallery, hotel/brand/PWA and service references. Keep AI asset and private receipt access authenticated and tenant-scoped; no static public path for private bytes.
- [ ] Use existing app service `85798` only if an owner-approved method isolates it from production traffic and writes; otherwise stop host proof. Do not create a duplicate service. Verify Git branch/preview behavior and commit/version/artifact identity. If CLI use is separately authorized, interactively select project `36927` and service `85798`; never use cached `deploy -y`.
- [ ] Prove RunFlare TLS/proxy request contract: host/forwarded headers, health endpoint, body size, timeout, streaming, graceful termination, auth callbacks, CSRF/logout, locale/custom-domain rewrites and external signaling if enabled.
- [ ] Keep production DNS unchanged and source Vercel serving. No Production writes, tenant migration, real SMS/payment/push or public launch during this phase.

**R6.2 exit:** repeatable isolated restore, matching migration ledger/data invariants, correct PrismaPg transactions, resolved media inventory, durable storage and artifact proof, clean Node 24 build/start/health/proxy behavior. Any target object, unexplained restore warning, unowned URL, secret leak or failed adapter check blocks R6.3.

## R6.3 — Tenant, commerce, reporting, security and durability acceptance

- [ ] Run role/tenant acceptance with approved synthetic/test tenants: tenant A cannot read or mutate tenant B, and anonymous/unauthorized users cannot read protected routes.
- [ ] Verify auth/session/callback/CSRF/logout on platform host and each approved custom-domain class using final TLS proxy headers and secret parity; retain only sanitized evidence.
- [ ] Verify public image URL/aliases and product/gallery, restaurant/service, hotel, branding and PWA render. Verify private retail receipt and AI-media content denies anonymous/cross-tenant access and is never cacheable/public.
- [ ] Run existing R3 guarded local/isolated acceptance against its required disposable PostgreSQL target; confirm required DB guard. Record exact 120-variant import stage timings against its 80-second simulated-transport ceiling, 500-row capacity result, idempotent replay, update ledger and CSV/XLSX round trip. Do not use Production for this test.
- [ ] Run existing R5 analytics acceptance on approved isolated synthetic data in an already-existing DB resource: 500-order aggregate result, constant query count relative to empty report as asserted by the test, captured `queryMilliseconds`, bounded 366-day windows, page/alert/export limits, tenant filtering and formula-safe CSV/XLSX. Establish and record an owner-approved wall-clock budget; source does not specify a universal R5 duration threshold.
- [ ] Recheck checkout/payment/inventory transaction contention and idempotency on PostgreSQL 17; payment/SMS/web-push remain sandboxed or disabled, with zero real sends.
- [ ] Determine required periodic jobs from the scheduler inventory in `R6-1-READINESS-AUDIT.md`. For each enabled job prove authentication, idempotency, retry, overlap control and one active scheduler; leave unresolved jobs disabled.
- [ ] Either prove shared atomic rate limiter and cache invalidation across instances or record explicit single-instance acceptance and its process-reset limits. Do not scale without this gate.
- [ ] Restart/redeploy the existing app service only under owner-approved isolation; verify media and DB state remain available. Prove independently backed-up DB/media restore only on already-existing separately approved isolated resources. None are identified here; if unavailable, stop this acceptance rather than creating DBs/services.
- [ ] Verify monitoring/alerts for health, errors, pool saturation, memory, disk/quota and backup failures. Complete rollback rehearsal without modifying Production.

**R6.3 exit:** all named tenant/security/commerce/reporting/media tests pass with durable evidence, no unowned gaps, backup/restart durability proven, resources accepted and release owner signs off. Failure returns to R6.2.

## R6.4 — Frozen final snapshot and cutover

- [ ] Release and data owners explicitly authorize source/target identities, full snapshot, maintenance window, final write-freeze, job pause, traffic switch and rollback authority.
- [ ] Identify the only authorized writer on source and on target during every substep; stop/drain in-flight writes and disable supported background writers before the final snapshot.
- [ ] Produce and hash an immutable full logical database snapshot at final cutoff; verify archive/TOC and independent backup storage. Preserve all migration-ledger rows and source objects.
- [ ] Capture final media object metadata and reconcile late writes to database references at the same cutoff. Copy only the approved set; verify every copied object checksum, access class and tenant owner. Keep historical aliases until rollback retention expires.
- [ ] Re-verify target identity, a verified independent target-only backup and the separately authorized target-only replacement/emptiness condition before restore. If permission or backup is absent, target has unexpected objects, or identity conflicts, stop the refresh only; never implicitly clean/overwrite or create a different database/service.
- [ ] Compare final database schema, `_prisma_migrations`, constraints/indexes, critical business invariants, references, object counts and checksums. Zero unexplained missing live refs and zero unreviewed restore warnings required.
- [ ] Verify application build/version, health, TLS/canonical host, tenant resolution, auth, representative order/report reads, public and private media behavior, pool headroom, monitoring, backup visibility and single-writer guard.
- [ ] Keep source Vercel read-only/write-frozen while RunFlare is the sole writer. Confirm authorized DNS/proxy operator and execute one controlled traffic switch only after all gates pass.
- [ ] Observe a bounded post-switch period with security, tenant, payment, media and resource checks; keep rollback evidence available.
- [ ] If RunFlare accepted writes, rollback requires freeze plus capture/reconciliation/replay or an explicitly accepted recovery point for every DB and media write before traffic returns to Vercel. DNS reversal alone does not pass this checklist.
- [ ] Decommission source resources, delete old media or expire backups only under a separate future approval after retention and a final reference scan.

**R6.4 exit:** final snapshot/media state reconciled, exactly one writable system, monitored service acceptance complete, rollback decision and retained artifacts recorded. Only then may release owner declare cutover complete.

## Evidence record fields

For every checked item, retain: phase; test/action identifier; source commit and service/deployment identity; database identity label (never credential); UTC timestamp; operator/approver; sanitized command/result or artifact path; exit code/status; counts and checksums where applicable; unresolved exceptions; and the next owner decision. Keep local, temporary-host, Vercel Production and RunFlare Production evidence separate.
