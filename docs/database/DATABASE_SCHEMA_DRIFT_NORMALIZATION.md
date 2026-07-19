# Database Schema Drift Normalization

Phase: `BAZAR-BAZ-DATABASE-SCHEMA-DRIFT-NORMALIZATION-01`

## Scope

This phase normalizes the schema produced by the complete Prisma migration chain
against the current application datamodel in `prisma/schema.prisma`.

No Production or hosted Preview database was used for proof. All migration and
diff checks are designed for disposable Docker PostgreSQL on `127.0.0.1` only.

## Original drift

`pnpm exec prisma migrate diff --from-url <local migrated db> --to-schema-datamodel prisma/schema.prisma --script`
against the accepted 52-migration chain reproduced 26 actionable SQL lines:

| Area | Drift | Classification | Authority | Action |
| --- | --- | --- | --- | --- |
| `ImageAccess` | enum missing from migration-derived DB | Semantic DB drift | Prisma schema/code | Add enum |
| `Image.access` | column/index missing | Semantic DB drift | Prisma schema/upload API | Add `access` with `PUBLIC` default and index |
| `DomainStatus` | legacy labels `PENDING`/`FAILED` remain in type | Semantic DB drift | Current domain lifecycle | Replace enum after prior backfill maps rows |
| `OrganizationDomain.status` | default/type differ | Semantic DB drift | Prisma schema/domain service | Drop default, cast to canonical enum, restore `REQUESTED` default |
| `OrganizationDomain.createdById` | FK missing | Constraint drift | Prisma schema/P11 audit ownership | Add nullable FK with `ON DELETE SET NULL` |
| `OrganizationDomain.updatedById` | FK missing | Constraint drift | Prisma schema/P11 audit ownership | Add nullable FK with `ON DELETE SET NULL` |
| `OrganizationDomain.reviewedById` | FK missing | Constraint drift | Prisma schema/P11 audit ownership | Add nullable FK with `ON DELETE SET NULL` |
| `SmsDelivery.customerId` | FK action is cascade | Semantic FK drift | Prisma schema/guest SMS model | Replace with `ON DELETE SET NULL` |
| `NotificationDeliveryAttempt.nextRetryAt` | timestamp precision differs | Type drift | Prisma schema | Convert to `TIMESTAMP(3)` |
| `NotificationDeliveryAttempt.createdAt` | timestamp precision differs | Type drift | Prisma schema | Convert to `TIMESTAMP(3)` |
| `NotificationDeliveryAttempt.updatedAt` | default and precision differ | Default/type drift | Prisma schema `@updatedAt` | Drop default, convert to `TIMESTAMP(3)` |
| `SmsDelivery.updatedAt` | database default differs | Default drift | Prisma schema `@updatedAt` | Drop default |
| Five long indexes | names differ only by Prisma truncation | Naming-only drift | Prisma schema/generated names | `ALTER INDEX ... RENAME TO ...` |

## ImageAccess Decision

Migration-derived state: no `ImageAccess` enum, no `Image.access` column, no
`Image_access_idx`.

Prisma-schema state:

```prisma
enum ImageAccess {
  PUBLIC
  PRIVATE
}

model Image {
  access ImageAccess @default(PUBLIC)
}
```

Application usage: `app/api/upload/route.ts`, `lib/blob-storage.ts`, and
`lib/media-storage.ts` accept and persist `PUBLIC` / `PRIVATE` image access
intent. No `ORGANIZATION`, `OWNER`, or `AUTHENTICATED` enum value is used as a
database value.

Authority: Prisma schema is authoritative. The migration adds the enum/column
with a `PUBLIC` default so existing rows keep their historical public behavior.

## DomainStatus Decision

Migration-derived state: `DomainStatus` originally contained
`PENDING, DNS_REQUIRED, VERIFYING, ACTIVE, FAILED, DISABLED`; later migrations
added `REQUESTED, PROVIDER_PENDING, ERROR, REMOVAL_PENDING, REMOVED`. The
accepted backfill migration `20260715000200_custom_domain_status_backfill`
maps `PENDING -> REQUESTED` and `FAILED -> ERROR`.

Prisma-schema state:

```prisma
enum DomainStatus {
  REQUESTED
  PROVIDER_PENDING
  DNS_REQUIRED
  VERIFYING
  ACTIVE
  ERROR
  DISABLED
  REMOVAL_PENDING
  REMOVED
}
```

Application usage: custom-domain validation, dashboard UI, Vercel automation,
and tests use the canonical nine-value lifecycle. Legacy `PENDING` and `FAILED`
are not accepted by current validation schemas.

Authority: current Prisma schema and domain lifecycle are authoritative. The
normalization migration replaces the enum only after the earlier backfill has
converted data. If any legacy row remains, PostgreSQL cast fails safely instead
of guessing or deleting rows.

## Index And Constraint Decisions

The five index differences are naming-only drift caused by Prisma's generated
identifier truncation. Definitions are otherwise identical, so the migration
uses guarded `ALTER INDEX ... RENAME TO ...`.

Foreign-key differences are semantic:

- `OrganizationDomain` ownership columns are nullable references to `User`, so
  the migration adds `ON DELETE SET NULL` FKs and fails if orphan values exist.
- `SmsDelivery.customerId` is nullable after guest SMS hardening, so cascade
  deletion is replaced with `ON DELETE SET NULL`.

## Forward Migration

New migration:

`prisma/migrations/20260719000000_normalize_schema_drift/migration.sql`

The migration:

- adds missing `ImageAccess` structures;
- normalizes `DomainStatus`;
- restores missing FKs;
- normalizes timestamp/default drift;
- renames naming-only index drift;
- does not edit historical migrations;
- does not delete/truncate data;
- does not use `db push`;
- intentionally fails on unmapped legacy enum data or invalid FK rows.

## Proof Tooling

Script:

`scripts/db/validate-schema-drift-normalization.mjs`

Package scripts:

- `pnpm run e2e:db:schema-drift-inspect`
- `pnpm run e2e:db:schema-drift-fresh`
- `pnpm run e2e:db:schema-drift-upgrade`
- `pnpm run test:db:schema-drift`
- `pnpm run quality:db:schema-drift`

The validator refuses non-local database URLs and `VERCEL_ENV=production`, uses
dynamic localhost Docker ports, random local passwords, `prisma migrate deploy`,
and final `prisma migrate diff`. Temporary reports are written under ignored
`.tmp/schema-drift/`.

## Final drift result

Fresh path target:

`empty local DB -> migrate deploy -> second migrate deploy -> migrate diff`

Expected result: semantically empty diff.

Upgrade path target:

`local DB before normalization -> representative legacy data -> normalization -> second migrate deploy -> migrate diff`

Expected result: data preserved and semantically empty diff.

## Production Activation

This phase does not run Production migration. Before Production activation:

1. take a verified backup;
2. inspect actual Production migration history/checksums;
3. inspect legacy `DomainStatus` row counts;
4. inspect nullable FK orphan preconditions;
5. run the migration in an authorized maintenance window;
6. verify final Prisma drift;
7. only then consider enabling Production asset consumption separately.
