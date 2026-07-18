# Database Migration Chain Recovery

Phase: `BAZAR-BAZ-DATABASE-MIGRATION-CHAIN-RECOVERY-01`

## Incident

The Prisma migration chain failed to deploy from a clean state at:

- **Migration:** `prisma/migrations/20260707000200_export_hub_extend_data_types/migration.sql`
- **Original SQL:**
  ```sql
  ALTER TYPE "ExportDataType" ADD VALUE 'CUSTOMERS';
  ALTER TYPE "ExportDataType" ADD VALUE 'FANPAGE_POSTS';
  ```
- **PostgreSQL error:** `42710` — `enum label "CUSTOMERS" already exists`
- **Prisma behavior:** `migrate deploy` aborts with `P3018`/`P3009`; the migration is
  recorded as failed (`started_at` set, `finished_at` NULL) and no further migrations apply.
- **Last successful migration before failure:** `20260707000100_request_demo_lead_storage`

## Root cause

`CUSTOMERS` and `FANPAGE_POSTS` are enum labels of the `ExportDataType` enum, not tables or
separate types.

- `20260628000300_export_hub_foundation` already creates the enum with all five labels:
  ```sql
  CREATE TYPE "ExportDataType" AS ENUM
    ('PRODUCTS', 'PRODUCT_CATEGORIES', 'ORDERS', 'CUSTOMERS', 'FANPAGE_POSTS');
  ```
- `20260707000200_export_hub_extend_data_types` then attempted to `ADD VALUE` the same two
  labels again. On any database where `20260628000300` already applied, the second
  `ALTER TYPE ... ADD VALUE` is a guaranteed `42710` failure.

The migration was manually written (it carries a `-- BB-B2B-P10-FIX1` comment and was not
produced by `prisma migrate dev`), and it contained only the two redundant `ADD VALUE`
statements plus a comment — no table or data changes.

## Recovery decision

**CASE A — correct the not-yet-deployed migration in place.**

Why this migration was corrected in place rather than adding a new compensating migration:

1. The migration physically cannot have been applied to any shared database. It
   unconditionally fails (`42710`) on any database where all prior migrations have
   successfully applied, including every managed Bazar Baz environment.
2. The corrected SQL creates **no new schema objects**. It only makes the redundant
   `ADD VALUE` operations idempotent no-ops.
3. All intended final enum labels already come from `20260628000300_export_hub_foundation`.
   The corrected migration changes the operation from an unconditional failure to an
   idempotent no-op that converges to exactly the same final schema.
4. No `AiMediaAsset` data, `ExportJob` rows, or other schema objects are lost or altered.

### Evidence supporting the edit

- `20260628000300_export_hub_foundation` already creates `ExportDataType` with `CUSTOMERS`
  and `FANPAGE_POSTS`.
- `20260707000200_export_hub_extend_data_types` contained **only** duplicate enum additions.
- The original SQL fails whenever all prior migrations have successfully applied
  (reproduced on a fresh disposable PostgreSQL: error `42710`).
- The corrected SQL creates no new schema objects.
- The correction changes the operation from unconditional failure to an idempotent no-op.
- All intended final enum labels already come from the earlier migration.
- **No Production migration was run** for this chain.
- Project handoff evidence states hosted environments were not migrated through this chain
  (local E2E uses `prisma db push` + `migrate resolve --applied`; the SQL is never executed
  against shared databases).

### Limitation of the evidence

We do not claim absolute proof about every unknown external clone. The precise, supportable
conclusion is:

> **Strong repository and deployment evidence indicates the migration was not successfully
> applied through its original SQL in any managed Bazar Baz environment.**

This is sufficient for the current project decision, but it avoids an unverifiable universal
claim. If a future environment shows a `_prisma_migrations` row for this migration marked
applied via the original SQL, that would contradict the evidence and require re-evaluation.

## Corrected SQL behavior

The migration now uses the repository's established guarded enum-extension pattern
(see `20260708000100_custom_domain_onboarding`):

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ExportDataType' AND e.enumlabel = 'CUSTOMERS'
  ) THEN
    ALTER TYPE "ExportDataType" ADD VALUE 'CUSTOMERS';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ExportDataType' AND e.enumlabel = 'FANPAGE_POSTS'
  ) THEN
    ALTER TYPE "ExportDataType" ADD VALUE 'FANPAGE_POSTS';
  END IF;
END $$;
```

- **Guarded:** it checks `pg_enum` for the exact `ExportDataType` label before adding it.
- **Idempotent:** on a clean deploy it is a no-op; on a database where the labels already
  exist it does nothing; the final schema is identical in both cases.
- **Same final schema:** `ExportDataType` ends with exactly
  `PRODUCTS, PRODUCT_CATEGORIES, ORDERS, CUSTOMERS, FANPAGE_POSTS`.

## Fresh database proof

- Disposable PostgreSQL (Docker `postgres:16-alpine`, `127.0.0.1` only).
- Normal `prisma migrate deploy` from an empty database.
- All **52 migrations** apply; **0** active failed migrations.
- `ExportDataType` has exactly the 5 intended labels (no duplicates).
- `AiMediaAsset.storageKey` exists and is nullable.
- `AiMediaAsset_storageKey_idx` exists.
- Core tables (`Organization`, `User`, `Product`, `Service`, `AiMediaAsset`, `ExportJob`,
  `Campaign`) are present.

## Upgrade proof

- Build baseline with all migrations **except** the conflicting one (simulating an existing
  installation that already has the enum populated), then apply the fixed chain.
- Existing data is preserved (organization, user, request, mirror, import, legacy asset).
- A **legacy `AiMediaAsset` without `storageKey`** is retained and remains hidden / not
  consumable (fail-closed).
- A new imported asset receives a real `storageKey` and is consumable.
- Second `migrate deploy` reports **no pending migrations**.
- `ExportDataType` enum remains intact with no duplicates.

## Failed-state recovery

- An **authentic Prisma-generated failed record** is produced: with the original failing SQL
  in place, `prisma migrate deploy` itself executes the SQL, hits `42710`, and records the
  migration as failed (`started_at` set, `finished_at` NULL).
- The Prisma-supported recovery marks it rolled-back:
  ```bash
  npx prisma migrate resolve --rolled-back 20260707000200_export_hub_extend_data_types
  ```
- A subsequent `prisma migrate deploy` with the fixed idempotent SQL succeeds.
- **No manual deletion of `_prisma_migrations` rows is used in the canonical recovery path.**
- Final state: the conflicting migration has a finished (applied) row, **0** active-failed
  migrations, and the enum is intact.

> **Note on Prisma version behavior:** in the installed Prisma version,
> `migrate resolve --rolled-back` retains a `_prisma_migrations` row (it sets
> `rolled_back_at`, it does not delete the row). `migrate resolve --applied` refuses if a row
> already exists (`P3017`). This is expected historical bookkeeping, not an error.
>
> **Manual `DELETE FROM _prisma_migrations` may remain only as disposable-test diagnostic
> tooling, clearly marked unsafe for shared environments. It is never part of the recommended
> Production procedure and is not used by the canonical recovery.**

## Drift status

| Area | Status |
|---|---|
| Migration execution chain | Green |
| `ExportDataType` / `CUSTOMERS` / `FANPAGE_POSTS` | Green |
| `AiMediaAsset.storageKey` | Green |
| Complete schema parity | Pending |
| Unrelated historical drift | Documented, out of scope |

### Major unrelated drift categories (not fixed in this phase)

`prisma migrate diff --to-schema-datamodel` reports ~56 lines of pre-existing schema-vs-
migrations drift that is **unrelated** to this incident and consistent with the project's
`db push` local-E2E approach:

- `ImageAccess` enum variants present in migrations but diverging from datamodel.
- `DomainStatus` variant removals / additions between migrations and datamodel.
- Index renames / renamed constraints between migrations and datamodel.

None of this drift involves `ExportDataType`, `CUSTOMERS`, `FANPAGE_POSTS`, or `storageKey`.
It is deferred to a separate **future database-normalization phase** (see below).

## Safety

- **No Production migration** was run.
- **No hosted Preview migration** was run.
- **No shared database writes** — all proofs use disposable local Docker PostgreSQL.
- **Localhost-only tooling** — the validator refuses non-local URLs and `VERCEL_ENV=production`.
- **No secrets printed or committed** — database URLs are never echoed; passwords are absent
  from logs.

## Future Production activation

Documented as prerequisites only. **Do not execute these steps in this phase.**

1. Take a verified database backup.
2. Inspect the actual Production `_prisma_migrations` history and checksums.
3. Compare migration checksums/history against the repository before applying anything.
4. Resolve any environment-specific failed state using supported `migrate resolve` commands.
5. Run the approved migration during a maintenance window.
6. Verify the `storageKey` schema is present post-migration.
7. Enable the asset-consumption server feature flag **separately** (it remains disabled in
   Production until then).
8. Monitor and retain a rollback procedure.

## Future database-normalization phase

The unrelated historical drift listed above should be reconciled in a dedicated phase that:
- Reconciles `ImageAccess` / `DomainStatus` enum variants with the datamodel.
- Normalizes renamed indexes/constraints.
- Re-establishes full `prisma migrate diff` parity (or an explicit, documented exception
  list) without data loss.
