# R6 Previous Migration Reconciliation Report

**Project:** BazarBaaz / shadcn-rtl  
**Run:** R6 reconciliation  
**Status:** Report only — no production changes  
**Git commit:** `5758860` (main)  
**GitHub Actions:** `41212341235` — success  
**Access state:** Current RunFlare destination database verified via read-only PostgreSQL inspection (commit `5758860`); `/disk` filesystem access not available from this environment. Connection established without TLS — server reported SSL unavailable (security exception, see Section 10).

---

## 1. Executive Summary

This report distinguishes three categories of evidence:

1. **Historical user-supplied reports** — October 24 media transfer and October 25 PostgreSQL restoration details recovered from ChatGPT conversation history. Not independently verified here.
2. **Verified local artifacts** — Files located at `C:\Users\disso\AppData\Local\BazarBaaz\R6.3/` with independently verified SHA-256 hashes.
3. **Verified isolated test results** — Restoration rehearsal scripts that validated source/destination row-count matching in isolated PostgreSQL containers.
4. **Completed source-code migration** — All Vercel runtime dependencies eliminated from production code paths (commit `5758860`).

The current RunFlare destination database (`databasewhy_db`) and the `/disk/media` volume **cannot be inspected from this environment** because:
- RunFlare private network is not reachable from the local Windows host
- `/disk` mount paths do not exist outside RunFlare nodes
- RunFlare CLI login expired; authenticated console access unavailable

Production cutover remains **NO-GO** pending current-state verification and explicit owner approval.

---

## 2. Completed Source-Code Migration

All items from section 7 of the previous report are now complete:

| Item | Status | Details |
|------|--------|---------|
| Default adapter → `persistent-disk` | **Complete** | `lib/storage/application-storage.ts:36`, `lib/storage/tenant-image-storage.server.ts:8` |
| Vercel Blob imports lazy | **Complete** | `application-storage.ts:58,97`, `receipt-storage.server.ts:39,56,75`, `blob-storage.ts:23,53,62` |
| Vercel Blob runtime blocked | **Complete** | Default adapter is `persistent-disk`; `blob-storage.ts` throws without `BLOB_READ_WRITE_TOKEN` |
| Domain automation module | **Complete** | `lib/domain-automation.server.ts` — DNS generation, verification, dry-run, no Vercel API |
| All 4 domain API routes migrated | **Complete** | Routes use `domain-automation.server.ts`, not `vercel-domain-automation` |
| Client copy text updated | **Complete** | `shop-domain-manager.tsx` — en/fa/ar provider-neutral copy |
| `deployment-context.ts` created | **Complete** | `isProductionRuntime()`, `isPreviewRuntime()`, `getDeploymentCommit()`, `getPlatformHost()` |
| Vercel env vars replaced | **Complete** | `seo.ts`, `custom-domain-routing.ts`, `inoti-ussd/ingress.ts`, `application-storage.ts`, `local-test-storage.ts`, `ai-media/*` |
| P04A-P06A quality gate | **Pass** | 24/24 checks pass (commit `5758860`) |
| Domain automation quality gate | **Pass** | 18/18 checks pass |
| Domain automation tests | **Pass** | 9/9 tests pass |
| Tenant image storage tests | **Pass** | 4/4 tests pass (incl. new no-Vercel-token regression test) |
| RunFlare receipt storage tests | **Pass** | 1/1 test passes |
| AI media preview tests | **Pass** | 11/11 + 15/15 tests pass |
| TypeScript typecheck | **Pass** | 0 errors |
| ESLint (changed files) | **Pass** | 0 errors, 0 warnings |
| Production Next.js build | **Pass** | 337 pages generated successfully |
| Hotel F5 fixtures migrated | **Complete** | `seed-f5-staging-fixtures.mjs` — removed `@vercel/blob`, uses local file writes |

---

## 3. October 24 Media Transfer Report (Historical, Unverified Locally)

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

## 4. October 25 PostgreSQL Restoration Report (Historical, Now Verified)

| Item | Reported Value | Verified |
|------|---------------|----------|
| Destination service | RunFlare service `85802` | **Verified** (ACTIVE) |
| Destination database | `databasewhy_db` | **Verified** |
| Restore method | RunFlare internal network | **Verified** (read-only connection) |
| Archive plaintext size | 1,012,695 bytes | Not verified locally |
| Plaintext archive SHA-256 | `6e685be6a70d442c2ea4ddfff9abe8d1e30eaf8a5b649e8458a570c43e8ac82c` | **Verified** against local file |
| TOC SHA-256 | `668dd89f34443dd85746d991e893ccf806cde954c80f3d94591c689ae086d591` | **Verified** against local file |
| Restore tool | PostgreSQL 17.11 pg_restore | Script present locally |
| Restore flags | `--exit-on-error --single-transaction --no-owner --no-acl` | In rehearsal script |
| TOC entries filtered | IDs 2 and 6900 (pg_session_jwt) | **Verified** in TOC and rehearsal script |
| Restored tables | 173 | **Verified** (164 public + 9 neon_auth) |
| Restored rows | 2,640 | **Partially verified** (business table counts below) |
| Prisma migration records | 115 (111 success, 4 rolled back) | **Verified** |
| neon_auth tables | 9 preserved | **Verified** |
| Deep health endpoint | HTTP 200 | Not verified (requires HTTP access) |
| Tenant smoke checks | HTTP 200 | Not verified (requires HTTP access) |
| Public media | HTTP 200 | Not verified (requires `/disk` access) |
| Quarantined media | HTTP 404 | Not verified (requires `/disk` access) |

### Verified Business Record Counts (Read-Only)

| Table | Row Count |
|-------|-----------|
| Organization | 15 |
| User | 43 |
| Product | 285 |
| ProductVariant | 504 |
| Order | 23 |
| OrderItem | 30 |

**Critical distinction:** The database is **POPULATED** with business data (not empty as the October 24 evidence showed). The October 25 restoration was executed on RunFlare. The release gate `runflareProductionRestore` is now **EXECUTED** as confirmed by direct read-only inspection.

`pg_session_jwt` extension entries (2/6900) were filtered from the restore per Path B approach. `btree_gist` v1.7 is available on the target. `plpgsql` v1.0 is installed.


---

## 5. Evidence Quality by Acceptance Condition

| Acceptance Condition | Status | Basis |
|---------------------|--------|-------|
| Verified archive existence | **PASS** | Plaintext archive file found at local path |
| Verified archive integrity | **PASS** | SHA-256 `6e685be6...` matches evidence JSON |
| Verified TOC integrity | **PASS** | SHA-256 `668dd89f...` matches evidence JSON |
| Successful isolated restoration | **PASS** (partial) | `migrationLedgerTargetedRestore: PASS`, `neonAuthSchemaTargetedRestore: PASS` in evidence JSON; scripts present locally |
| Successful production restoration | **PASS** | **Verified** via read-only PostgreSQL inspection: `databasewhy_db` populated, 173 tables, 115 migrations (111 success, 4 rolled back) |
| Current RunFlare database contents | **VERIFIED** | 164 public tables, 9 neon_auth tables; business records populated (Organization: 15, User: 43, Product: 285, ProductVariant: 504, Order: 23, OrderItem: 30) |
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

## 7. Exact Authentication or Infrastructure Blockers

| Blocker | Detail | Required Owner Action |
|---------|--------|----------------------|
| RunFlare authenticated access | RunFlare CLI login expired; cached `-y` auth fails | Restore RunFlare CLI session / provide remote terminal access |
| RunFlare destination DB inspection | `databasewhy_db` on service `85798` not reachable locally | Provide read-only PostgreSQL access or RunFlare service terminal |
| RunFlare `/disk` inspection | `/disk` media volume not mounted outside RunFlare nodes | Provide file access via RunFlare console or file manager |
| Historical Vercel Blob read access | No `BLOB_READ_WRITE_TOKEN` available locally; cannot inventory 90 objects | Provide Blob read token for migration reconciliation only |
| Neon source DB read-only access | Neon API token expired `2026-10-24T12:50:18Z` | Renew Neon API token with read-only scope |
| Docker unavailable locally | Cannot run isolated PostgreSQL 17 test container independently | Use RunFlare remote PG or owner-provisioned test DB |

---

## 8. Acceptance Condition Separation

| Condition | Reported | Locally Verified | Current RunFlare State |
|-----------|----------|-------------------|----------------------|
| October 24 media transfer (90 objects) | Yes | No | Unknown |
| October 25 database restoration (173 tables, 2,640 rows) | Yes | No | **VERIFIED** — database populated, 173 tables, 115 migrations |
| `pg_session_jwt` extension filtered | Yes (in TOC) | Yes | Verified via Path B approach |
| `btree_gist` available on target | Unknown | Unknown | **VERIFIED** v1.7 installed |
| `manuallyUnavailable` column exists | Unknown | Unknown | **NOT PRESENT** — 1 pending migration (`20261030215000_add_manually_unavailable_to_variant`) |
| Application reads from `databasewhy_db` | Unknown | Unknown | Owner confirms yes |

---

## 9. GO/NO-GO Recommendation

**NO-GO** for production cutover.

Reason: Database verification complete — `databasewhy_db` is populated with business data, 173 tables, 115 migrations (111 successful, 4 rolled back), `btree_gist` v1.7 available. However, one Prisma migration remains pending: `20261030215000_add_manually_unavailable_to_variant`. The `manuallyUnavailable` column does not exist on `ProductVariant`. Media verification and active release verification remain incomplete.

**Required before GO:**
1. Restore RunFlare authenticated access and inspect `databasewhy_db` — **DONE** (verified via read-only PostgreSQL)
2. Confirm database is populated with expected business data — **DONE** (verified: Organization: 15, User: 43, Product: 285, ProductVariant: 504, Order: 23, OrderItem: 30)
3. Verify `/disk/media/tenants/` contains expected media files — **PENDING** (requires RunFlare filesystem access)
4. Confirm application service `85798` reads from `databasewhy_db` — **PENDING** (requires deployment verification)
5. Apply pending migration `20261030215000_add_manually_unavailable_to_variant` — **PENDING** (requires explicit owner authorization — production write)
6. Obtain explicit owner authorization for cutover

---

## 10. Security Exception — Database Connection Without TLS

**Finding:** The read-only PostgreSQL audit connected to `remote-fanhang.runflare.com:30560` without TLS because the server reported SSL unavailable. The `pg` client was configured with `ssl: false` after the server rejected SSL negotiation. **No `rejectUnauthorized: false` bypass was used** — the server simply does not offer TLS.

**Classification:** Infrastructure security finding, not a verified secure connection.

**Required actions:**
1. Do not initiate further unencrypted public database connections to this endpoint
2. Investigate supported secure alternatives (RunFlare private network, VPN tunnel, SSH tunnel, or RunFlare-provided TLS endpoint) without changing production configuration
3. Prepare a credential-rotation and remote-access restriction plan preserving the running application's database connection
4. Do not execute credential rotation or access changes without explicit owner authorization

**Audit integrity:** All read-only SELECT queries executed inside `BEGIN READ ONLY` / `ROLLBACK` transaction. No credentials logged, printed, or committed.

