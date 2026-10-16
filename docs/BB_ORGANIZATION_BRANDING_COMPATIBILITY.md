# OrganizationBranding Historical Compatibility Review

**Status:** Production compatibility remains blocked; no Production access or mutation was performed.

## Verified source evidence

The accepted historical source commit is `57e407077f88c22c62ff12ff15cc6c2602ee3c96`. Its Production-only migration `20260926160000_repair_organization_branding_columns` adds nine nullable columns using `ADD COLUMN IF NOT EXISTS`:

| Column | Historical repair | Current `OrganizationBranding` Prisma model | Later source migration/reference |
|---|---|---|---|
| `applicationName` | Added | Absent | Historical F5 inspection script expects it before the migration pass; no application field reference was found in current source. |
| `pwaMaskable192Url` | Added | Present | Also added by `20260830000300_tenant_branding_extensions`; current app and schema use it. |
| `pwaMaskable512Url` | Added | Present | Also added by `20260830000300_tenant_branding_extensions`; current app and schema use it. |
| `monochromeIconUrl` | Added | Absent | Added by `20260830000300_tenant_branding_extensions`; no current non-migration application reference was found. |
| `markUrl` | Added | Absent | Added by `20260830000300_tenant_branding_extensions`; no current non-migration application reference was found. |
| `logoInverseUrl` | Added | Absent | Added by `20260830000300_tenant_branding_extensions`; no current non-migration application reference was found. |
| `themeColor` | Added | Present | Also added by the tenant-branding extension migration; current model uses it. |
| `backgroundColor` | Added | Present | Also added by the tenant-branding extension migration; current model uses it. |
| `deletedAt` | Added | Absent | No `OrganizationBranding.deletedAt` relation/reference exists in the current model or application query; `deletedAt` on other models is unrelated. |

The current `OrganizationBranding` model has `displayName`, `shortName`, logo/favicon/Apple icon, regular and maskable PWA icon paths, theme/background colors, OG image, source/sync metadata and timestamps. It has a unique `organizationId` and a cascading Organization FK. It does not model the five absent columns above. Exact current model: `prisma/schema.prisma`, `model OrganizationBranding`; exact migration sources: `prisma/migrations/20260830000300_tenant_branding_extensions/migration.sql` and the historical repair SQL in the cited Git commit.

The later candidate migration `20260830000300_tenant_branding_extensions` adds seven columns without `IF NOT EXISTS`: maskable 192/512, monochrome, mark, inverse logo, theme and background. The historical repair uses `IF NOT EXISTS` for all nine. Production’s successful ledger contains the repair after the historical branding chain. Therefore, a future combined run must establish actual existing columns and ordering before running either exact chain. A direct replay of the non-idempotent seven-column migration over already-existing columns can fail. The repair’s idempotence is not permission to add it as a duplicate or change its SQL.

The old F5 rehearsal check expected `applicationName` and `deletedAt` before migrations and seven later columns after. That check is historical evidence of a compatibility expectation, not proof that those fields are needed by current runtime code or remain in Production. Current code search found no non-migration application use for `applicationName`, `monochromeIconUrl`, `markUrl`, or `logoInverseUrl`; it found no OrganizationBranding soft-delete behavior. No Production catalog query was made.

## Recommendation

Do **not** add a speculative migration or change the current Prisma model yet. First inspect the current authorized Production catalog and fresh ledger with the package in `BB_PRODUCTION_READONLY_INSPECTION_PLAN.md`. Determine:

1. Whether each of the nine columns exists, including type, nullability, default and any indexes.
2. Whether the successful repair row is present with the expected name/checksum and execution timestamps.
3. Which historical `20260830000300_tenant_branding_extensions` DDL actually ran, given its checksum divergence.
4. Whether current deployed code or any maintained client still selects/writes the four legacy asset/application fields, and whether any consumer relies on branding soft deletion.

If all current consumers need only the current model and the five fields are legacy-only, document a compatible additive model/schema decision for review; do not drop columns. If any live consumer requires a missing column, prepare a new additive, guarded compatibility migration only after current catalog evidence and a Production-lineage disposable rehearsal. If fields exist but are intentionally legacy, retaining extra nullable database columns while leaving them unmapped in Prisma may be safer than exposing stale fields in the application contract. Never remove `deletedAt` or the legacy asset columns as part of this reconciliation.

## Regression requirements for any later approved change

- Prisma schema validation and generated client check against the reviewed target schema.
- Fresh PG17 full-chain migration test.
- Production-lineage clone starting from sanitized verified schema plus exact ledger identities/checksums and recorded order.
- Tests for branding resolver selects and writes, PWA manifest construction, tenant-owned asset values, nullable legacy fields, organization deletion/cascade semantics, and no cross-tenant leakage.
- Confirm no runtime P2022 on organization domain/branding reads.
- Confirm older unknown columns and existing data are preserved; no `DROP COLUMN`, `DROP TABLE`, broad update, or migration-ledger rewrite.
- Back up/restore rehearsal and forward/rollback runbook before any separately approved Production change.

**VERIFIED:** repair migration SQL and SHA are in Git; current Prisma model and later migration definitions; no current non-migration application references found for the five absent names.
**INFERRED:** schema repair is not currently justified solely by the persisted migration history; a current catalog snapshot is needed to choose whether current schema should model any legacy fields.
**BLOCKED:** actual Production column state and deployed consumers.
**NOT CHECKED:** Production table values, column existence today, or runtime query errors.
