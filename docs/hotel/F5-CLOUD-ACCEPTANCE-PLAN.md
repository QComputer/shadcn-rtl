# Hotel F5 cloud acceptance and staging decision

Status: preparation only. No Neon branch/database/role, Vercel environment, deployment, migration or test fixture was created or written in this task.

## Read-only identity evidence

- Neon project `aged-star-89488704` was verified via the authenticated Neon CLI through the local HTTP CONNECT proxy. The project is PostgreSQL 17 in `aws-us-east-1`; the owner’s Production branch/database references match the read-only SQL identity (`current_database=neondb`, role `neondb_owner`, `transaction_read_only=on`). No credentials or connection strings are stored here.
- Neon CLI account metadata reported Free. Public plan limits indicate up to 3 schema-only roots and up to 10 branches/project on Free, but remaining quota/storage and branch-creation permissions are not authoritatively available from the CLI metadata. The current project inventory has four branches (one parentless default root); two non-Production branches are existing children and one is archived. Do not treat this count as a server-confirmed root quota.
- The Neon MCP config is project-scoped with `projectId=aged-star-89488704` and a `readonly=true` query parameter. This Codex session did not discover an MCP tool, so OAuth discovery and effective server-side read-only enforcement remain unverified. Reopen/reload Codex in this worktree, then perform a read-only inventory. Do not reinstall the MCP/skill.
- Vercel inspection confirmed the dedicated project `hotel-damoon-f5-staging-20261013`; deployment SSO is set to all deployments except custom domains. Git-triggered deployments remain enabled, so do not push this branch until preview suppression is configured and checked. No settings were changed.

## Migration facts and decision

See [F5-PRODUCTION-MIGRATION-MANIFEST.md](F5-PRODUCTION-MIGRATION-MANIFEST.md) for all source SQL hashes, execution order, ledger status, Production checksums and rollback attempts.

The Production ledger contains 90 rows, 86 distinct successful migration names and four rolled-back attempts. The current source has 95 migrations: 85 source names applied in Production, 58 with matching checksums, 27 with divergent checksums, and 10 unattempted Hotel migrations. Production also has one successful historical branding-repair migration absent from this source; its exact Git artifact checksum was verified and is recorded in the migration manifest. Production’s read-only catalogs show no Hotel-prefixed public table or enum. `OrganizationBranding` has nine nullable/additive fields from that repair, while the current F5 Prisma model omits these extra legacy fields. This is a targeted catalog comparison, not a full database schema diff.

The 10 pending source migrations define 24 Hotel-prefixed tables (`HotelProperty`, `HotelRoomType`, booking/inventory/publication tables, and website content/review/media/operation tables) plus three website enums. None appeared in the Production catalog query. The F5 Prisma `OrganizationBranding` model currently includes the core identity/icon fields only; Production additionally has `applicationName`, `pwaMaskable192Url`, `pwaMaskable512Url`, `monochromeIconUrl`, `markUrl`, `logoInverseUrl`, `themeColor`, `backgroundColor`, and `deletedAt`. These nine columns are nullable/additive in the recovered migration. A full all-table schema diff remains outstanding; do not treat the targeted checks as schema-wide proof.

Do not make a schema-only root branch the first migration target. A schema-only root copies schema but not rows or `_prisma_migrations`, and the current source has 27 checksum divergences. Safest strategy: first run the manual PostgreSQL 17 GitHub Actions migration rehearsal in an ephemeral empty database; only after all migration, repeatability, branding and rollback checks pass should the owner approve a dedicated schema-only root. On that root, create a separate, newly empty application database and staging-only roles; verify branch/database/role/schema/ledger identity before writes. Never run the 96 chain against a schema-only copy of Production tables with an empty ledger, and never wholesale `migrate resolve --applied`.

The F5 source can provide a deterministic **empty-database** chain, but schema-only branch provisioning alone does not establish an empty database: that exact Neon behavior must be verified in the Console/API before any branch/database creation. If the operator cannot create a verifiably empty database there, stop; do not stamp history or reset a copied schema.

## PostgreSQL 17 rehearsal

`.github/workflows/hotel-f5-acceptance.yml` is manual-only. Its `postgres-17-migration-rehearsal` job creates a fresh ephemeral GitHub Actions PostgreSQL 17 service, checks the empty local target, applies the 95-source chain, validates branding/platform/Hotel table presence, exercises rollback of a forced transactional DDL probe, retrieves the exact historical branding SQL from Git, verifies its hash, reapplies it idempotently and reruns `migrate deploy`. The job is prepared but has not run; it is not evidence of migration acceptance. It cannot prove preservation of Production rows; it verifies non-Hotel table structure in an initially empty synthetic database.

## Browser acceptance workflow

The optional `authenticated-staging-browser` job is opt-in via `workflow_dispatch` input and GitHub Environment `hotel-f5-staging`. It runs the existing two-scenario Playwright acceptance suite against already-provisioned staging URLs with distinct synthetic author/reviewer/manager/foreign accounts and SSO state stored only in runner temp. The suite itself creates uniquely tagged synthetic editorial revisions and revokes publication in cleanup. The separate fixture accounts, domains and eligible media must be prepared by the approved staging operator; this workflow does not seed the database. It does not run automatically and has not run.

Before enabling the browser job, create the named GitHub Environment, configure every `HOTEL_F5_*` variable/secret referenced by the workflow, and confirm its URLs are only SSO-protected F5 hosts. Keep `HOTEL_BOOKING`, hold, payment and notification runtime gates disabled. The workflow’s assertion variables are not a substitute for inspecting actual environment settings.

## Cost and resource estimate

Neon CLI reports Free; public pricing advertises Free plan quotas (100 CU-hours/project/month, 1 GB/project storage, max 2 CU, and up to 3 schema-only roots). The branch inventory suggests four of ten ordinary branch slots currently present and one parentless default root; it does not prove remaining quota or root-branch authorization. A schema-only branch consumes schema storage and compute when active; always-on staging may exhaust the included CU-hours. No reliable project usage/storage meter or exact incremental cost was available in read-only metadata. Recheck current account limits, usage, billing behavior and spend controls in Neon Console before owner approval. This report does not claim F5 will be free.

## Exact actions still requiring owner approval/operator access

1. Reload Codex so the project-local Neon MCP is discovered; complete OAuth if prompted; verify actual server identity and effective read-only permissions, then repeat branch inventory through MCP. MCP availability is not needed for the already completed CLI read-only ledger inspection.
2. Review the committed migration rehearsal workflow and authorize running it in GitHub Actions. It writes only the disposable hosted PG17 service and does not contact Neon.
3. Confirm schema-only root eligibility, remaining root/storage/compute quota, spend controls and whether an independently empty database can be created on that root.
4. Suppress Vercel Preview deployments for this branch before any push; SSO is currently on, but Git deployments are enabled.
5. Approve the exact Neon schema-only root plus empty-database/role plan after the PG17 rehearsal passes. Create dedicated least-privilege runtime and migration roles and set only the separate F5 Vercel environment variables.
6. Provision synthetic-only tenant/domain/capability, distinct users and public/foreign media; then opt into the browser workflow for CMS edit → preview → submit → independent approval → publish → public view → revoke.

No production migration, production data change, public booking, payment, notification, DNS change, Render action, Vercel deployment or push was performed.
