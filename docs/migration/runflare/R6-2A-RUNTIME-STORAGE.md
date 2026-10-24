# R6.2-A runtime and storage implementation

This follow-on supersedes R6.1's deployment-authorization gate: the owner authorized normal main deployments, including existing RunFlare Auto Pull. R6.1 remains a historical read-only audit. PR #19 merged at `e654eba24589f728175e3bcc4ac87e47972875ba`. No DNS cutover, source retirement, database restore, or media transfer is part of this implementation.

## Runtime configuration

| Setting | RunFlare contract | Existing Vercel behavior |
|---|---|---|
| `DATABASE_RUNTIME_ADAPTER` | Explicit `postgresql` selects `PrismaPg` over ordinary PostgreSQL TCP | Unset remains `neon`; no automatic provider inference |
| `DATABASE_URL` | Protected runtime connection to the verified existing destination | Existing runtime URL retained |
| `DIRECT_URL` | Protected direct maintenance URL; required by existing Prisma generation/configuration | Existing value retained |
| `DATABASE_POOL_MAX` | Default 5 per Node process, integer 1–100; size against actual target connection budget | Default 5 configuration accepted; existing Neon adapter unchanged |
| `DATABASE_CONNECT_TIMEOUT_MS` | Default 10000, integer 1–120000 | No TLS weakening or host-based override |
| `DATABASE_IDLE_TIMEOUT_MS` | Default 10000, integer 1–300000 | No credentials logged |
| `APPLICATION_STORAGE_ADAPTER` | `persistent-disk` | Unset remains `vercel-blob` |
| `MEDIA_STORAGE_ROOT` | Absolute `/disk/media`; directory created on first storage operation | Not used by Blob |
| `AI_MEDIA_APPLICATION_STORAGE_ADAPTER` | Leave unset, or explicitly align to `persistent-disk`; this existing creative-storage override has precedence | Preserve intentional existing override |
| `NEXTAUTH_SECRET` and versioned payment signing keys | Preserve verified existing values through approved secret handling; never generate replacements for migrated accounts | No changes |

Do not enable destination writes against the shared source Neon URL. Verify destination service `database-giu-service`, database `databasewhy_db`, PostgreSQL identity, restored schema and ledger before enabling tenant use. No migration is run during application startup or build.

## Persistent media contracts

`lib/storage/persistent-disk-storage.ts` implements the existing application-storage adapter. New generic/tenant uploads use `tenants/<organizationId>/uploads/<filename>`; creative assets retain `creative-studio/<organizationId>/...`; private payment receipts use `retail-payment/<organizationId>/<filename>` internally while preserving their existing database receipt keys. Legacy `/uploads/<filename>` reads resolve ownership through the existing `Image` row, rather than searching other tenants. Existing image IDs, gallery relationships and order snapshots are unchanged.

Writes validate file signatures, size, ownership and SHA-256; publish through exclusive same-filesystem temporary files and hard links; fsync files/directories on Linux; store access/ownership metadata separately; reject overwrites with different metadata or content. Reads validate checksums and regular files, reject symlinks, traversal and encoded path escapes. Missing/interrupted objects fail closed. R6.2-B must transfer both bytes and adapter-compatible metadata, verify checksums, and reconcile orphans before use. This is not an automated transfer implementation.

Public images are served through `/api/media/<organizationId>/<key>` with immutable caching. Private tenant image reads require organization ADMIN/MANAGER (platform media requires SUPER_ADMIN), use `private, no-store`, and cannot become public through a URL alone. Payment receipts always remain inaccessible through that general media endpoint and use the existing audited receipt route. Existing Blob storage and URLs remain available on the source deployment. Do not switch adapters before historical assets have been transferred and alias coverage verified.

Single-instance operation is the initial requirement. Real RunFlare filesystem hard-link support, restart/redeployment persistence, permissions, backups, replica visibility and full target upload acceptance still require provider execution. Temporary local disk tests are not proof of `/disk` durability.

## Neon-specific compatibility decision

The application uses NextAuth and public account tables, not Neon Auth. Source read-only catalog inspection on 2026-10-24 verified nine `neon_auth` tables (three rows total), zero RLS policies, no catalog dependency on `auth`/`pgrst` routines, and extension-owned routines in `auth` only. `pgrst.pre_config` is independent, not owned by `pg_session_jwt`, and has no auth calls. Catalog dependency checks alone cannot prove absence of dynamic SQL dependencies; source inspection also found no application use.

Preserve a complete native archive, all nine Neon Auth tables and every row. Prefer native extension restoration when the actual destination supports it. Otherwise the reviewed TOC filter may omit only the exact `pg_session_jwt` EXTENSION and COMMENT entries, after target capability verification and archive-list hash approval. Preserve all other objects; never create dummy JWT functions or discard Neon Auth records. Target extension availability is not yet verified. See `R6-2A-MIGRATION-TOOLING.md` for inert planning commands.

## Concrete RunFlare build finding

On 2026-10-24, service 85798 synchronized main `e654eba...`, but image v4 / 603559 failed. The preset ran `npm --registry=https://mirror-npm.runflare.com install --force`, ignored the pnpm lockfile, and resolved an unavailable `@next/env@16.4.3` (ETARGET). The running container was the initial nginx placeholder, without Node; Git-event completion did not mean application deployment success.

This implementation pins existing tested Next and eslint-config-next to 16.2.7 and declares Node 24. Existing lockfile resolutions are unchanged; frozen offline lockfile validation passed, and the RunFlare mirror returned `@next/env` 16.2.7. This corrects the observed resolution error, but does not prove a subsequent provider build succeeds. The service variable inventory exposed only HOST/PORT, with no secret bindings; required database/auth configuration must be supplied through approved provider configuration before a working application can be claimed. Do not substitute fake production credentials or point the destination at source data to mask this prerequisite.

## Validation evidence

Operator evidence: `C:/Users/disso/.codex/artifacts/runflare-r62a-20261024/` (sanitized results/logs; not committed). PostgreSQL 17 acceptance passed 5/5 using the actual PrismaPg runtime, concurrent advisory-lock overlap, isolation, rollback and pool reuse. Existing Retail P0 database acceptance passed against the existing isolated PostgreSQL fixture, covering catalog, variants, checkout, stock and tenant boundaries. The full Next 16.2.7 production build, TypeScript and Prisma validation passed. Focused media/planner/config unit suites and scoped lint are recorded in that directory; consult final result files for exact final counts.

No shared source database writes, Blob transfer/deletion, DNS changes, customer password changes, orders or inventory changes occurred. No new worktree or database service was created.
