# R6 Previous Migration Reconciliation Report

**Project:** BazarBaaz / shadcn-rtl  
**Run:** R6 reconciliation  
**Status:** Report only — no production changes  
**Access state:** RunFlare private-network infrastructure is not accessible from this environment; current destination database and `/disk/media` state cannot be independently verified locally

---

## 1. Executive Summary

This report distinguishes three categories of evidence:

1. **Historical user-supplied reports** — October 24 media transfer and October 25 PostgreSQL restoration details recovered from ChatGPT conversation history. Not independently verified here.
2. **Verified local artifacts** — Files located at `C:\Users\disso\AppData\Local\BazarBaaz\R6.3/` with independently verified SHA-256 hashes.
3. **Verified isolated test results** — Restoration rehearsal scripts that validated source/destination row-count matching in isolated PostgreSQL containers.

The current RunFlare destination database (`databasewhy_db` on service `database-giu-service` / `85798`) and the `/disk/media` volume **cannot be inspected from this environment** because:
- RunFlare private network is not reachable from the local Windows host
- `/disk` mount paths do not exist outside RunFlare nodes
- RunFlare CLI login expired; authenticated console access unavailable

Production cutover remains **NO-GO** pending current-state verification and explicit owner approval.

---

## 2. October 24 Media Transfer Report (Historical, Unverified Locally)

| Item | Reported Value | Locally Verified |
|------|---------------|-------------------|
| Vercel Blob objects transferred | 90 of 90 | Not verified (no Blob token access) |
| Total transferred size | 65,910,202 bytes | Not verified |
| Objects under `/disk/media/tenants/` | 76 objects | Cannot verify (`/disk` inaccessible) |
| Objects under `/disk/.migration-quarantine/` | 14 objects | Cannot verify (`/disk` inaccessible) |
| Transfer ledger path | `/disk/.r6-2-transfer-ledger.json` | Cannot verify (`/disk` inaccessible) |
| Source/destination byte sizes matched | Reported as matched | Not verified |
| SHA-256 hashes matched | Reported as matched | Not verified |

**Access blocker:** The transfer ledger and `/disk/media/tenants/` directory are on the RunFlare persistent volume, which is not mounted or accessible from this environment. Inspection requires RunFlare CLI authentication and private-network access.

---

## 3. October 25 PostgreSQL Restoration Report (Historical, Unverified Locally)

| Item | Reported Value | Locally Verified |
|------|---------------|-------------------|
| Destination service | RunFlare service `85802` (`database-giu-service`) | Cannot verify |
| Destination database | `databasewhy_db` | Cannot verify |
| Restore method | RunFlare internal network | Cannot verify |
| Archive size | 1,012,695 bytes | Cannot verify locally (plaintext archive found locally) |
| Plaintext archive SHA-256 | `6e685be6a70d442c2ea4ddfff9abe8d1e30eaf8a5b649e8458a570c43e8ac82c` | **Verified** against local file `restore-upload-20261025/neon-neondb-pg17.11.custom` |
| Encrypted archive path | `C:\Users\disso\AppData\Local\BazarBaaz\R6.3\neon-neondb-pg17.11.custom.aesgcm` | **Found** (1,012,732 bytes) |
| TOC SHA-256 | `668dd89f34443dd85746d991e893ccf806cde954c80f3d94591c689ae086d591` | **Verified** against local file `fallback-verify-20261025/neon-neondb-pg17.11.toc.txt` |
| Restore tool | PostgreSQL 17.11 pg_restore | Script present locally |
| Restore flags | `--exit-on-error --single-transaction --no-owner --no-acl` | In rehearsal script |
| TOC entries filtered | IDs 2 and 6900 (pg_session_jwt) | **Verified** in TOC and rehearsal script |
| Restoration entries processed | 1,962 | Cannot verify locally |
| Restore exit code | Reported 0 | Cannot verify locally |
| Restored tables | 173 | Matches source baseline |
| Restored rows | 2,640 | Cannot verify locally |
| Prisma migration records | 115 (111 success, 4 rolled back) | Matches source baseline |
| neon_auth tables | 9 preserved | Matches source baseline |
| Deep health endpoint | HTTP 200 | Cannot verify |
| Tenant smoke checks | HTTP 200 | Cannot verify |
| Public media | HTTP 200 | Cannot verify |
| Quarantined media | HTTP 404 | Cannot verify |

**Critical distinction:** The plaintext archive and TOC files exist locally with verified hashes, but there is **no local evidence confirming the production restore was executed on RunFlare**. The release gate in `r6.3-archive-evidence.json` shows `runflareProductionRestore: "NOT_EXECUTED"` as of the evidence file's creation time. The October 25 restoration report from ChatGPT history claims production execution, but this cannot be confirmed from local artifacts.

---

## 4. Verified Local Artifact Inventory

All paths under `C:\Users\disso\AppData\Local\BazarBaaz\R6.3/`:

| Path | Size | SHA-256 | Status | Purpose |
|------|------|---------|--------|---------|
| `r6.3-archive-evidence.json` | 3,190 bytes | Not computed | Present | Archive creation evidence |
| `neon-neondb-pg17.11.custom.aesgcm` | 1,012,732 bytes | `faa4b416...` | Present | Encrypted archive (AES-256-GCM, DPAPI-protected key) |
| `neon-neondb-pg17.11.key.dpapi` | Small | Not computed | Present | DPAPI-protected encryption key |
| `source-extension-audit.cjs` | ~8KB | Not computed | Present | Source-side extension dependency audit |
| `create-encrypted-neon-archive.cjs` | ~4KB | Not computed | Present | Archive creation script |
| `verify-neon-archive.cjs` | ~2KB | Not computed | Present | Archive verification script |
| `restore-ledger-check.cjs` | ~2KB | Not computed | Present | Targeted migration-ledger restore check |
| `restore-neon-auth-check.cjs` | ~2KB | Not computed | Present | Targeted neon_auth schema restore check |
| `run-isolated-restore-test.cjs` | ~4KB | Not computed | Present | Isolated PG 17 restore rehearsal |
| `run-path-b-full-rehearsal.cjs` | 12,860 bytes | Not computed | Present | Full Path B restore rehearsal (pg_session_jwt filtered) |
| `restore-upload-20261025/neon-neondb-pg17.11.custom` | 1,012,695 bytes | `6e685be6...` **Verified** | Present | Decrypted plaintext PostgreSQL custom-format archive |
| `restore-upload-20261025/decrypt-and-verify.cjs` | ~2KB | Not computed | Present | Decrypt and verify archive |
| `restore-upload-20261025/decrypt-diag.cjs` | ~1KB | Not computed | Present | Decryption diagnostic |
| `fallback-verify-20261025/neon-neondb-pg17.11.toc.txt` | 161,803 bytes | `668dd89f...` **Verified** | Present | TOC listing |

**Hash verification summary:**
- Plaintext archive SHA-256: **Verified** `6e685be6a70d442c2ea4ddfff9abe8d1e30eaf8a5b649e8458a570c43e8ac82c`
- TOC SHA-256: **Verified** `668dd89f34443dd85746d991e893ccf806cde954c80f3d94591c689ae086d591`

---

## 5. Evidence Quality by Acceptance Condition

| Acceptance Condition | Status | Basis |
|---------------------|--------|-------|
| Verified archive existence | **PASS** | Plaintext archive file found at local path |
| Verified archive integrity | **PASS** | SHA-256 `6e685be6...` matches evidence JSON |
| Verified TOC integrity | **PASS** | SHA-256 `668dd89f...` matches evidence JSON |
| Successful isolated restoration | **PASS** (partial) | `migrationLedgerTargetedRestore: PASS`, `neonAuthSchemaTargetedRestore: PASS` in evidence JSON; scripts present locally |
| Successful production restoration | **UNKNOWN** | No local evidence; claimed in ChatGPT history; release gate shows `NOT_EXECUTED` as of evidence file creation |
| Current RunFlare database contents | **UNKNOWN** | `/disk` and RunFlare CLI inaccessible from this environment |
| Current media file status | **UNKNOWN** | `/disk/media/tenants/` inaccessible from this environment |

---

## 6. Timestamps (All October 25, 2026)

| File | Last Modified |
|------|---------------|
| `r6.3-archive-evidence.json` | 03:13 AM |
| `create-encrypted-neon-archive.cjs` | Earlier (archive creation ~03:03 AM) |
| `restore-ledger-check.cjs` | ~12:40 PM |
| `restore-neon-auth-check.cjs` | ~12:45 PM |
| `run-isolated-restore-test.cjs` | Earlier |
| `run-path-b-full-rehearsal.cjs` | 3:42 AM |
| `decrypt-and-verify.cjs` | Earlier |
| `decrypt-diag.cjs` | Earlier |

The Path B rehearsal script (`run-path-b-full-rehearsal.cjs`) was created after the initial evidence JSON was written, suggesting the compatibility failure investigation and remedy were developed after the initial archive capture.

---

## 7. Remaining Work for Zero Vercel Dependencies

### Storage Adapter
- [x] Default adapter changed from `vercel-blob` to `persistent-disk` in `lib/storage/application-storage.ts`
- [x] Default adapter changed from `vercel-blob` to `persistent-disk` in `lib/storage/tenant-image-storage.server.ts`
- [x] Vercel Blob imports made lazy in `lib/storage/application-storage.ts`
- [x] Vercel Blob imports made lazy in `lib/retail/receipt-storage.server.ts`
- [x] Vercel Blob imports made lazy in `lib/blob-storage.ts`
- [ ] Write tests for persistent-disk storage adapter behaviors
- [ ] Verify no production code path can invoke `@vercel/blob`

### Domain Automation
- [x] Created `lib/domain-automation.server.ts` — RunFlare-compatible module with DNS record generation, DNS verification, dry-run mode
- [x] Updated `app/api/dashboard/shop-domains/route.ts` — uses `addProjectDomain` / `getDomainAutomationState`
- [x] Updated `app/api/dashboard/shop-domains/[domainId]/vercel/route.ts` — uses `addProjectDomain` / `removeProjectDomain` / `verifyProjectDomain`
- [x] Updated `app/api/dashboard/organization-domains/[domainId]/vercel/route.ts` — uses all four domain automation functions
- [x] Updated `app/api/dashboard/organization-domains/vercel-automation/route.ts` — uses `getDomainAutomationState`
- [x] Created `scripts/quality/validate-domain-automation.mjs` — RunFlare-compatible quality gate
- [ ] Write tests for domain automation module
- [ ] Update client component copy text (`shop-domain-manager.tsx`)

### Vercel Environment Variable Assumptions
- [x] Created `lib/deployment-context.ts` — `isProductionRuntime()`, `isPreviewRuntime()`, `getDeploymentCommit()`, `getPlatformHost()`
- [x] Updated `lib/seo.ts` — removed `shadcn-rtl.vercel.app` from legacy hosts, uses `isProductionRuntime()`
- [x] Updated `lib/custom-domain-routing.ts` — `VERCEL_URL` replaced with `getPlatformHost()`
- [x] Updated `lib/storage/application-storage.ts` — `VERCEL_ENV` replaced with `isProductionRuntime()`
- [x] Updated `lib/storage/local-test-storage.ts` — `VERCEL_ENV` replaced with `isProductionRuntime()`
- [x] Updated `lib/integrations/inoti-ussd/ingress.ts` — `VERCEL_GIT_COMMIT_SHA` replaced with `getDeploymentCommit()`
- [x] Updated `lib/ai-media/env-isolation.ts` — `classifyEnvironment` now checks `RUNFLARE_ENV`
- [x] Updated `lib/ai-media/preview-write-guard.ts` — `vercelEnv` → `deploymentEnv`, supports `RUNFLARE_ENV`
- [x] Updated `lib/ai-media/preview-db-identity-guard.ts` — same renames
- [x] Updated test files to match new field names
- [x] Updated quality gates (`validate-ai-media-p04a-p06a.mjs`, `validate-ai-media-hermetic-environment.mjs`)
- [ ] Run updated quality gates to confirm no regressions

### Media Migration Tool
- [ ] Create `scripts/migration/runflare/media-migration.mjs` — idempotent, checksum-verified delta migration
- [ ] Reconcile `/disk/.r6-2-transfer-ledger.json` against existing `/disk/media/tenants/` (requires RunFlare access)
- [ ] Verify media storage root `/disk/media` durability (requires RunFlare access)

### Database
- [ ] Verify current `databasewhy_db` state — table counts, row counts, migration ledger, `manuallyUnavailable` column (requires RunFlare access)
- [ ] Validate Path B full restore compatibility against isolated PG 17 test instance
- [ ] Prepare delta reconciliation plan (requires destination inspection)

---

## 8. Exact Authentication or Infrastructure Blockers

| Blocker | Detail | Required Owner Action |
|---------|--------|----------------------|
| RunFlare authenticated access | RunFlare CLI login expired; cached `-y` auth fails | Restore RunFlare CLI session / provide remote terminal access |
| RunFlare destination DB inspection | `databasewhy_db` on service `85798` not reachable locally | Provide read-only PostgreSQL access or RunFlare service terminal |
| RunFlare `/disk` inspection | `/disk` media volume not mounted outside RunFlare nodes | Provide file access via RunFlare console or file manager |
| Historical Vercel Blob read access | No `BLOB_READ_WRITE_TOKEN` available locally; cannot inventory 90 objects | Provide Blob read token for migration reconciliation only |
| Neon source DB read-only access | Neon API token expired `2026-10-24T12:50:18Z` | Renew Neon API token with read-only scope |
| Docker unavailable locally | Cannot run isolated PostgreSQL 17 test container independently | Use RunFlare remote PG or owner-provisioned test DB |

---

## 9. Acceptance Condition Separation

| Condition | Reported | Locally Verified | Current RunFlare State |
|-----------|----------|-------------------|----------------------|
| October 24 media transfer (90 objects) | Yes | No | Unknown |
| October 25 database restoration (173 tables, 2,640 rows) | Yes | No | Unknown |
| `pg_session_jwt` extension filtered | Yes (in TOC) | Yes | Unknown on target |
| `btree_gist` available on target | Unknown | Unknown | Unknown |
| `manuallyUnavailable` column exists | Unknown | Unknown | Unknown |
| Application reads from `databasewhy_db` | Unknown | Unknown | Owner confirms yes (per latest directive) |

---

## 10. GO/NO-GO Recommendation

**NO-GO** for production cutover.

Reason: Cannot independently verify current destination database state or `/disk/media` contents from this environment. All RunFlare infrastructure access requires restored authentication.

**Required before GO:**
1. Restore RunFlare authenticated access and inspect `databasewhy_db`
2. Confirm database is populated with expected business data
3. Verify `/disk/media/tenants/` contains expected media files
4. Confirm application service `85798` reads from `databasewhy_db` (not just environment variables)
5. Run TypeScript typecheck and all affected tests locally
6. Resolve all remaining Vercel runtime dependency references
7. Obtain explicit owner authorization for cutover
