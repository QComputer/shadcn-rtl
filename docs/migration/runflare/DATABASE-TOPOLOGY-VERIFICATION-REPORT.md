# Database Topology Verification Report

## Report Metadata
- Generated: 2026-10-31T13:51:26+03:30
- Source baseline commit (HEAD): 99d097052a105930cbfe5edc5710876e77ad57b6
- Analysis period: R6.1 audit evidence (2026-10-24) + current repository state
- Methodology: Read-only source code review, documentation analysis, local artifact inspection, provider CLI attempts

---

## 1. Verified Active Production Database

**Neon PostgreSQL 17.11 — currently authoritative for production writes**

### Evidence (verified 2026-10-24 via read-only SQL identity queries)

| Property | Verified Value |
|---|---|
| Provider | Neon |
| Project ID | aged-star-89488704 |
| Branch ID | br-small-queen-aii58cw9 |
| Endpoint ID | ep-little-river-aifwxtf7 |
| Host | ep-little-river-aifwxtf7-pooler.c-4.us-east-1.aws.neon.tech |
| Database | neondb |
| PostgreSQL version | 17.11 (11592b3) |
| Transaction read-only | on (verified in-session) |
| Database size | 26,845,184 bytes |
| max_connections | 112 |
| Encoding | UTF8, C.UTF-8, builtin collation provider b, version 1 |
| Timezone | GMT |
| Default isolation | read committed |
| Shared preload libraries | neon, pg_stat_statements, timescaledb, pg_partman_bgw, rag_bge_small_en_v15, rag_jina_reranker_v1_tiny_en, lakebase_vector, lakebase_text |

### Migration ledger: 115 rows (111 successful, 4 rolled back, 0 unfinished)

### Schema: 173 tables total
- 164 tables in public schema, 9 tables in 
eon_auth schema
- 880 indexes in public, 21 indexes in 
eon_auth (901 total)
- Extensions installed: btree_gist 1.7, pg_session_jwt 0.5.0, plpgsql 1.1

### Constraints
- 369 validated foreign keys
- 49 validated check constraints
- 172 primary keys
- 9 unique constraints
- 1 exclusion constraint (Hotel GiST, requires btree_gist)

### Other objects
- 13 non-internal triggers
- 0 RLS policies
- 0 large objects

### Data fingerprint (173 tables, 67 with data):
Key business tables with row counts:
- public.Organization: 15 rows
- public.User: 43 rows
- public.OrganizationMember: 34 rows
- public.Product: 269 rows
- public.ProductVariant: 280 rows
- public.Order: 18 rows
- public.OrderItem: 24 rows
- public.OrderStatusHistory: 19 rows
- public.ProductCategory: 38 rows
- public.ProductCategoryAssignment: 270 rows
- public.ProductVariantImage: 12 rows
- public.ProductVariantAttributeValue: 12 rows
- public._ImageToProduct: 128 rows
- public.OrganizationDomain: 6 rows
- public.OrganizationSettings: 13 rows
- public.UssdSession: 21 rows
- public.OrganizationInotiPaymentRouting: 15 rows
- public.OrganizationActivationTask: 51 rows
- 106 tables empty (new feature tables not yet used)

Total rows across all tables: 2,624

### Vercel Production deployment
- Deployment ID: dpl_4Gfqhn9n6o4mpGt6bcpTYTjUqw6e (READY)
- Commit: 368e545e40cca95ddd9749d42c560d7444b1daa5
- Node: 24.x
- 13 aliases

**ASSESSMENT**: This Neon database is the single authoritative production database. All production writes (orders, inventory, users, tenants) go here.

---

## 2. Verified RunFlare Destination Database

**Runflare PostgreSQL 17.4 — verified EMPTY on 2026-10-24**

### Evidence (verified 2026-10-24 via read-only SQL identity queries through Runflare service 85802)

| Property | Verified Value |
|---|---|
| Provider | Runflare |
| Internal service | database-giu-service (Runflare service #85802) |
| Database | databasewhy_db |
| Owner/admin | postgres |
| PostgreSQL version | 17.4 (Debian 17.4-1.pgdg120+2) |
| Primary status | pg_is_in_recovery() = false (writable primary) |
| Application tables | ZERO (empty) |
| Extensions available | btree_gist 1.7 (NOT installed), plpgsql 1.1 (installed) |
| pg_session_jwt | NOT available on target |

**ASSESSMENT**: Destination is empty. The missing pg_session_jwt extension is a hard compatibility blocker for native restore.

---

## 3. Evidence of Source/Destination Data Equivalence or Difference

### Summary: NOT EQUIVALENT — Destination is empty, source has production data

| Metric | Source (Neon) | Destination (Runflare) |
|---|---|---|
| Tables | 173 (164 public + 9 neon_auth) | 0 |
| Migration ledger entries | 115 (111 success, 4 rolled back) | 0 |
| Rows of data | 2,624 across 67 tables | 0 |
| Extensions installed | btree_gist, pg_session_jwt, plpgsql | plpgsql only |
| PostgreSQL version | 17.11 | 17.4 (7 minor releases behind) |

### Classification: Scenario B
Neon is currently authoritative for production writes. RunFlare PostgreSQL destination is empty. A controlled PostgreSQL-to-PostgreSQL logical transfer is required before Runflare can serve production data.

**ASSUMPTION WARNING**: Destination emptiness was verified on 2026-10-24. The current repository HEAD (99d0970) was committed on 2026-10-30. Freshness of destination status must be re-verified before any restore operation.

---

## 4. Read-Only Access Status

### Current Status: BLOCKED — No authenticated read-only connection available

| Access Method | Status | Details |
|---|---|---|
| Neon API token | EXPIRED | Token in credentials.json expired 2026-10-24T12:50:18Z (7 days ago). DNS resolution to api.neon.tech also failed from this environment. |
| Runflare CLI login | EXPIRED | Requires email/password login. Cached -y flag fails with "Wrong password or Token expired - please check your password and login again!" |
| inspect-production-migration-metadata.mjs | BLOCKED | Requires BB_PRODUCTION_READONLY_INSPECTION_APPROVED=YES, runtime and endpoint attestation file paths, and BB_PRODUCTION_READONLY_URL. production-migration-target.expected.json has readOnlyRole: null, which fails validation at line 39. |
| Remote read-only role | NOT CONFIGURED | No read-only database role exists in the expected target configuration. readOnlyRole is null in the expected JSON. |
| Local Prisma verification | UNAVAILABLE | guard-local-prisma-env.mjs requires localhost PostgreSQL on a specified port — no local PostgreSQL available. |
| Docker | UNAVAILABLE | Migration chain validator (scripts/db/validate-migration-chain.mjs) requires Docker for isolated PostgreSQL 17 testing. |

### Required owner action for read-only inspection:
1. Re-authenticate Runflare CLI or provide API token for service 85798
2. Re-authenticate Neon API (token expired) or provide Neon API key
3. Create and configure a least-privilege read-only database role
4. Set production-migration-target.expected.json readOnlyRole to the approved role name
5. Provide BB_PRODUCTION_READONLY_INSPECTION_APPROVED=YES and BB_PRODUCTION_READONLY_URL environment variables
6. Provide runtime and Neon endpoint attestation JSON files at paths specified by BB_PRODUCTION_RUNTIME_ATTESTATION_PATH and BB_NEON_ENDPOINT_ATTESTATION_PATH

**ASSESSMENT**: No read-only database inspection could be performed from this environment. All findings rely on R6.1 audit evidence (2026-10-24) and repository source code analysis.

---

## 5. Pending Migration Inventory

### Source database ledger (verified 2026-10-24): 115 entries

### Repository migration directories: 115 + 1 new = 116

### Pending migrations (in repository but NOT in source ledger):

| Migration ID | Description | DDL |
|---|---|---|
| 20261030215000_add_manually_unavailable_to_variant | Add manuallyUnavailable column to ProductVariant for independent sales availability control | ALTER TABLE "ProductVariant" ADD COLUMN "manuallyUnavailable" BOOLEAN NOT NULL DEFAULT false; CREATE INDEX "ProductVariant_manuallyUnavailable_idx" ON "ProductVariant"("manuallyUnavailable"); |

### Migration safety assessment:
- **Backward compatible**: ADD COLUMN with NOT NULL DEFAULT false does not break existing queries
- **No default value conflict**: All existing rows get manuallyUnavailable = false
- **Performance**: CREATE INDEX is non-blocking in PostgreSQL 17 (CONCURRENTLY not needed for new table)
- **Prisma schema**: ProductVariant model already has manuallyUnavailable Boolean @default(false) at line 2419 of prisma/schema.prisma
- **Application code**: Routes at app/api/dashboard/retail/catalog/[productId]/variants/route.ts implement the feature
- **Tests**: Retail variant generation tests pass (part of 102-test suite)

**ASSESSMENT**: The single pending migration is safe to apply to both source and destination.

---

## 6. Backup and Recovery Readiness

### Current status: NO BACKUP EXISTS

| Component | Status |
|---|---|
| Source metadata artifact | Available (sanitized) at C:/Users/disso/.codex/artifacts/runflare-r61-20261024/source-metadata.json |
| Source metadata contents | Identity, ledger summary, extensions, settings, collation, object counts, 173 table fingerprints |
| Production database backup | NOT CREATED |
| Migration chain validator | scripts/db/validate-migration-chain.mjs (requires Docker, unavailable) |
| Migration planner | scripts/migration/runflare/plan.mjs (generates inert planning commands, does not execute) |
| Restore rehearsal | NOT PERFORMED |
| Target backup | NOT CREATED |

### Recovery procedures (documented, not executed):
- DATABASE-MIGRATION-RUNBOOK.md: Full logical dump/restore with pg_dump --format=custom / pg_restore
- R6-2A-MIGRATION-TOOLING.md: Inert planning CLI with source/target identity validation
- No startup migrations: confirmed (migration chain validator checks _prisma_migrations at startup)

**ASSESSMENT**: Backup and recovery readiness is NOT established. The source metadata artifact exists but is a catalog fingerprint, not a backup. Full backup and restore rehearsal require explicit owner authorization and Docker access for testing.

---

## 7. RunFlare Service Configuration Status

### Application Service (85798)
**Verified configuration (from R6.2A, 2026-10-24):**

| Setting | Configured Value | Source |
|---|---|---|
| Runflare project | 36927 | Owner-confirmed via console |
| Service/app ID | 85798 | Owner-confirmed via console |
| Node.js | 24.22.1 | Console observation |
| Repository | QComputer/shadcn-rtl | Console observation |
| Git branch | main | Console observation |
| Auto Pull | ON (checked) | Console observation |
| DATABASE_RUNTIME_ADAPTER | postgresql | Owner-authorized, verified |
| PGHOST | database-giu-service | Owner-authorized, verified |
| PGDATABASE | databasewhy_db | Owner-authorized, verified |
| PGUSER | postgres | Owner-authorized, verified |
| PGPASSWORD | (secret reference) | Not printed (secret store) |
| APPLICATION_STORAGE_ADAPTER | persistent-disk | Owner-authorized, verified |
| MEDIA_STORAGE_ROOT | /disk/media | Owner-authorized, verified |
| NEXTAUTH_SECRET | (new RunFlare-only secret) | Owner-authorized, bound by reference |
| AUTH_TRUST_HOST | (expected: true) | From ENVIRONMENT-MAPPING.md |
| RUNFLARE_ENFORCE_LOCKFILE | 1 | Owner-authorized |

### Build history:
- Last sync: main commit e654eba (Oct 24, 2026)
- Last build attempt: image v4/603559 — **FAILED**
- Failure cause: preset ran 
pm install --force instead of pnpm, resolved @next/env@16.4.3 (ETARGET)
- Fix: commit e8a9f2e added RUNFLARE_ENFORCE_LOCKFILE=1 and pnpm lockfile enforcement
- Runflare CLI v1.2.2 available but login expired

### Runtime adapter status:
- lib/db-runtime.ts at HEAD 99d0970 supports both PrismaNeon and PrismaPg
- When DATABASE_RUNTIME_ADAPTER=postgresql, uses PrismaPg with connection from PG* env vars
- When DATABASE_RUNTIME_ADAPTER=neon (default), uses PrismaNeon (current source behavior)
- prisma.config.ts calls applyPrismaPostgresEnvironment() to set DATABASE_URL/DIRECT_URL from PG* vars

### Auth compatibility:
- NEXTAUTH_SECRET replaced with RunFlare-only secret
- Previously issued Vercel sessions will NOT authenticate on Runflare
- All users must sign in again after cutover
- Password hashes and organization memberships are unaffected (in database, not JWT)

**ASSESSMENT**: RunFlare application service is partially configured with PostgreSQL settings. Code at HEAD supports the adapter. Build failed on last attempt due to npm/pnpm mismatch; lockfile enforcement has been added but not yet proven on a fresh build. No secrets or database connection verified live at cutover time.

---

## 8. Recommended Migration/Cutover Scenario

### Selected: Scenario B — Neon is currently authoritative and RunFlare is empty

**Justification:**
- Source (Neon) has all production data: 173 tables, 2,624 rows, 115 migration ledger entries
- Destination (Runflare PostgreSQL) was verified EMPTY on 2026-10-24 with zero application tables
- No evidence of split-brain (Runflare app build failed, no writes to destination)
- Production traffic still served by Vercel → Neon

**Required sequence (from R6-EXECUTION-ROADMAP.md):**

1. **R6.2**: Isolated restore
   - Verify destination is still empty (fresh check required — was verified 2026-10-24)
   - Resolve pg_session_jwt extension compatibility (source has it, target doesn't)
   - Execute pg_dump --format=custom from Neon
   - Execute pg_restore into databasewhy_db on database-giu-service
   - Wire PrismaPg runtime adapter (code is ready at HEAD)
   - Prove frozen-lockfile pnpm build on Node 24
   - Prove build/start/health/proxy behavior on isolated service
   - Preserve _prisma_migrations ledger exactly (no replay)

2. **R6.3**: Tenant and operational acceptance
   - Test tenant isolation, auth, commerce, media against isolated data
   - Verify proxy/TLS/custom-domain behavior on Runflare
   - Prove backup/restart/media durability

3. **R6.4**: Final cutover (requires explicit authorization)
   - Write freeze on source (Vercel/N Neon)
   - Final snapshot at coherent cutoff
   - Reconciliation of late writes
   - DNS/proxy traffic switch
   - Monitored post-switch acceptance

---

## 9. Required Owner Actions

### Immediate (before any production operation):

1. **Re-authenticate Runflare CLI** — provide credentials or API token for service 85798 inspection. Current cached auth has expired.

2. **Re-authenticate Neon API** — provide fresh Neon API token. Current token in credentials.json expired 2026-10-24.

3. **Confirm destination database state** — re-verify that databasewhy_db on database-giu-service (Runflare service 85802) is still empty and is the writable primary. Was verified empty on 2026-10-24 but must be re-checked immediately before any restore.

4. **Decide on pg_session_jwt extension compatibility** — source has pg_session_jwt 0.5.0 installed (owns functions in uth schema, used by Hotel). Target does NOT have this extension available. Options:
   - Install pg_session_jwt on Runflare target (if provider supports it)
   - Use the reviewed TOC filter to omit only the extension and its comment entries (R6-2A-MIGRATION-TOOLING.md)
   - This must be explicitly decided and approved — no silent omission

5. **Decide on PostgreSQL minor version lag** — source is 17.11, target is 17.4 (7 minor releases behind). Ask provider whether target can be upgraded before migration.

6. **Authorize source database backup** — explicit authorization for pg_dump --format=custom of Neon source database. Include backup destination and retention policy.

7. **Authorize restore operation** — explicit authorization to execute pg_restore into databasewhy_db on database-giu-service. Requires proof of empty destination and independent target backup.

8. **Authorize write-freeze window** — define the R6.4 maintenance window: source write-freeze, final snapshot timing, traffic switch window, rollback window.

9. **Provide media migration authorization** — Vercel Blob contains 90 objects / 65,910,202 bytes. Object-level metadata was not enumerated (missing Blob credentials). Authorize media transfer and provide sanitized object metadata export.

10. **Authorize Runflare build verification** — deploy a reviewed commit (e.g., 99d0970) through separate authorization to prove build/start/health on Node 24 with frozen lockfile. Do NOT use cached deploy -y.

---

## 10. Clear GO / NO-GO Recommendation

### Recommendation: NO-GO for production cutover

**The release candidate code at HEAD 99d0970 is ready** (TypeScript valid with 0 errors, ESLint clean with 0 errors/warnings, 102 tests pass, production build succeeds). The PostgreSQL runtime adapter (PrismaPg) is implemented and the new migration is backward-compatible.

**However, infrastructure verification is incomplete and no production cutover should proceed:**

### Critical blockers (all must be resolved before R6.4):

1. **Source database identity not freshly re-verified** — was verified on 2026-10-24, 7 days ago
2. **Destination database state not freshly re-verified** — was verified empty on 2026-10-24
3. **No read-only access available** — all credentials expired, no read-only role configured
4. **pg_session_jwt extension** — source has it, target does not; compatibility decision pending
5. **PostgreSQL version mismatch** — source 17.11, target 17.4 (7 minor releases behind)
6. **Runflare build unproven** — last build attempt failed (npm/pnpm mismatch); lockfile enforcement added but not yet tested
7. **No backup created** — source database has no independent backup
8. **Media transfer incomplete** — Vercel Blob inventory not fully enumerated
9. **Runflare CLI credentials expired** — cannot verify current service configuration
10. **Write-freeze/cutover window not authorized** — R6.4 requires explicit window authorization

### What CAN proceed:
- Code at HEAD 99d0970 is validated and ready
- The PostgreSQL runtime adapter code is implemented and reviewed
- The single pending migration is safe (backward-compatible ADD COLUMN)
- The migration planner (scripts/migration/runflare/plan.mjs) can generate inert command plans offline
- The source metadata artifact at C:/Users/disso/.codex/artifacts/runflare-r61-20261024/source-metadata.json provides catalog fingerprints for later comparison

### What CANNOT proceed without owner action:
- Any database migration, restore, or write operation
- Any Runflare deployment of reviewed code to production
- Any DNS cutover or traffic switch
- Any media transfer

**Status: R6.1 planning complete. R6.2 execution blocked pending explicit owner authorization for database backup, restore, and isolated host verification.**
