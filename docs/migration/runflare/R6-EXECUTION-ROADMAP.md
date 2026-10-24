# R6 Execution Roadmap: Runflare Migration

**Current milestone: R6.1 planning documentation only.** Source baseline: `368e545e40cca95ddd9749d42c560d7444b1daa5`. No deployment, infrastructure, database, media, DNS or source-code mutation is authorized by this document. Estimates are focused person-days, excluding provider wait time and independent review; recalibrate after R6.2 inventory.

## Dependency sequence

```text
R6.1 readiness and plan
  -> R6.2 isolated restore, compatibility changes and isolated app-host proof
    -> R6.3 tenant, auth, commerce, media, restart and backup acceptance
      -> R6.4 approved write freeze, final snapshot/media reconciliation
        -> one-way traffic switch to Runflare and monitored acceptance
```

R6.2 precedes meaningful tenant acceptance because runtime hard-selects `PrismaNeon` and production media defaults to Vercel Blob. R6.3 must pass before scheduling the final snapshot. R6.4 reconciles database and media at a coherent cutoff before switching traffic. A DNS-only rollback after Runflare writes is unsafe; it requires write freeze and data reconciliation.

## R6.1 — Readiness and plan

**Deliverables:** all nine documents listed in the readiness audit, plus the owner-approved one-branch deployment suppression. Record confidence labels, baseline, blockers, acceptance boundaries and owner decisions. Preserve console project `36927`, service `85798`, repository `QComputer/shadcn-rtl`, branch `main`, Auto Pull enabled. Do not alter these settings.

**Exit gate:** all nine repository-specific documents, confidence labels, risk owners and measurable later-phase gates are delivered. Before authorizing R6.2, resolve target extension/identity evidence and assign proxy/DNS/TLS, secret, backup and release owners. R6.1 is not a production-ready claim; build/start/health remain unproven.

**Estimate:** 1–2 engineering days for plan review and owner decisions.

## R6.2 — Isolated restore, adapter/storage implementation and host proof

**Prerequisites:** explicit authorization naming the source snapshot, existing RunFlare PostgreSQL database `databasewhy_db` on existing service `database-giu-service` (owner `postgres`, target version reported as 17.4), existing application service, approved test data, media inventory/access, secrets custodian and retention policy. The target database may already contain objects; prove its identity and emptiness before any restore. Restore only into this existing DB if it is empty and approved. If non-empty or ambiguous, stop. Do not clean it, create another database, or provision duplicate services. Keep production DNS untouched and Vercel serving. Apply data/privacy approval to any isolated copy.

**Database:** run the read-only catalog/ledger/invariant inventory in `DATABASE-MIGRATION-RUNBOOK.md`; rehearse only on an already-existing, separately approved isolated database resource; none is identified in this R6.1 scope. If such a resource is unavailable, stop restore rehearsal rather than creating another database or service. Preserve `_prisma_migrations` exactly and use logical backup/restore, never `db push`, seed, migration replay or startup migration. Confirm identities, PostgreSQL versions, extensions, collation, roles and transaction behavior. Wire installed `@prisma/adapter-pg` via PrismaPg in `lib/db-runtime.ts`, retaining the Prisma CLI boundary in `prisma.config.ts` and separate direct `DIRECT_URL`. Validate pool bounds, transactions, locks and isolation.

**Media:** reconcile metadata and references for `lib/storage/application-storage.ts`, `lib/storage/vercel-blob-storage.ts`, `lib/blob-storage.ts`, `lib/media-storage.ts`, `lib/retail/receipt-storage.server.ts`, `/uploads/[filename]`, product/gallery, hotel/brand/PWA, AI-media and private receipts. Resolve tenant/access ambiguity before copying. Implement the chosen backend behind compatible seams; do not reuse `local-test` in production or activate `/disk/media` until mount persistence, permissions, quota, backup/restore, replica visibility and failures are proven. Keep aliases and private authorization.

**Existing application service proof:** use service `85798` only if an owner-approved method isolates it from production traffic and writes; otherwise stop host proof. Do not create a duplicate service. Deploy only a reviewed commit through connected Git or use explicit interactive project/service selection for separately authorized CLI; never use cached-target `deploy -y`. Verify project/service and commit/version before build. Keep real integrations disabled. Prove build/start/restart/health, TLS/proxy/host routing, auth, uploads and reads against approved test tenants. Do not configure production DNS or accept production traffic.

**Exit gate:** repeatable restore to the existing target only if it is proved empty and approved, with rehearsal on a separately approved existing isolated DB (none identified at R6.1); ledger and data invariants match; PrismaPg transaction/locking behavior passes; media inventory is resolved and durable; no startup migrations; artifacts exclude secrets/dumps; Runflare build/start/health passes; tenant and private-media denial passes. Any unresolved object, restore warning or provider mismatch blocks R6.3.

**Estimate:** 8–15 engineering days after inventory and provider access, plus 2–5 operator days for restore/review/isolated-host acceptance. Media volume or incompatibility may increase this.

## R6.3 — Tenant and operational acceptance

Use existing service `85798` and approved test tenants only if an owner-approved method isolates its traffic and writes; otherwise stop. Do not provision a duplicate service. Exercise implemented roles and tenant boundaries, login/callback/CSRF/logout on platform and supported custom domains, catalog/order/payment, appointments/calendar, soft-delete/audit, public uploads, private receipts and AI asset routes. Review each deployed acceptance script (`scripts/e2e/deployed-phase1-security.mjs` through phase 10) for environment requirements and side effects before use; never point it at Production or enable real sends. Add Runflare-specific proxy/cache/rate-limit and persistent-media acceptance.

Restart/redeploy the existing service only under approved isolation; prove media availability. Rehearse restore only on an already-existing separately approved isolated DB (none identified at R6.1); if unavailable, stop acceptance rather than creating a DB/service. Compare schema, ledger, critical counts/fingerprints, sequences and tenant invariants. Verify health/log monitoring and storage/resource alarms. Either prove shared limiter/cache before multi-instance use or obtain explicit single-instance acceptance of process-local limits. Rehearse rollback without modifying Production.

**Exit gate:** acceptance matrix passes with durable evidence and no unresolved blockers; restart/redeploy, backup/restore and privacy controls pass; resource/storage margins are accepted. Failures return to R6.2; no production cutover is implied.

**Estimate:** 4–7 engineering days and 2–4 operator/tenant-owner days, excluding remediation.

## R6.4 — Final snapshot, media reconciliation and controlled cutover

Requires explicit data-owner and release-owner approval naming source/target identities, maintenance window, write-freeze method, traffic switch, rollback owner and customer communication. Refreshing a rehearsal on the existing target DB requires a separate, explicit target-only replacement authorization after a verified independent backup. If this permission is absent, stop the refresh only; do not clean, overwrite or create another DB/service. Pause writes, drain in-flight work and stop authorized background jobs. Capture a final full logical snapshot and media/object metadata at a coherent cutoff. Reconcile late writes/media since rehearsal by stable key and checksum; preserve aliases and old source objects. Restore only into the approved existing target after the explicitly authorized replacement/emptiness condition is satisfied. No source reset or implicit target overwrite is permitted.

Before traffic switch, verify database identity/version, schema and migration ledger, runtime adapter, health, canonical host/TLS, tenant resolution, auth, representative reads, media/private denial, job state, monitoring and that only one side accepts writes. Switch through approved DNS/proxy control. Observe a bounded acceptance window with source write-frozen. Rollback must account for every write/media change accepted on Runflare; DNS reversal alone cannot recover them. Retain source snapshots and objects through approved retention. Source cleanup/decommission requires separate later authorization.

**Exit gate:** final snapshot and media manifest recorded, checksums/counts reconciled, no unexplained missing live references, one writable side, monitored post-switch acceptance and rollback decision documented. Do not declare completion while reconciliation, write ownership or rollback is open.

**Estimate:** 2–4 engineering days plus 2–5 coordinated operator/DB/media-owner days in the maintenance window; actual elapsed time depends on snapshot size and transfer speed.

## Controls across phases

- Keep credentials in approved secret stores and out of commits, logs, history, manifests and docs. Exclude `.git`, `.env*`, private config, `node_modules`, build output and database dumps from deploy artifacts.
- Do not change enabled Git Auto Pull. Do not push this docs-only branch; preview behavior for non-main branches is unknown.
- Never use cached-project CLI `deploy -y`. If separately authorized, interactively select project `36927` and service `85798`, verify both identifiers, and inspect packaged files. CLI `status` file-change output is not health evidence.
- R6.1 authorizes no production migration, seed, data write, media copy/delete, DNS edit, real provider send, restart or environment mutation.
- Never run migrations on startup. Inspect/compare post-restore migration state; do not replay it as a data-transfer shortcut.
- `/disk/media` remains a proposal until a production adapter and durability contract exist. Preserve private receipt/AI-media checks and tenant isolation.
- Keep optional SMS, web-push, AI, Vercel domain automation and scheduled actions disabled until individually approved.

## R6.1 evidence boundary

The console resource, Git connection and CLI version/help observations above were supplied by the root audit. The package combines repository inspection with read-only provider metadata and source SQL evidence; no database/service writes, build, deployment, media transfer or DNS/environment change occurred. The approved branch-only Vercel suppression is the sole tracked configuration exception. Estimates are sequencing aids, not evidence of completed work.
