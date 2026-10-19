# Hotel content C1B1 PostgreSQL acceptance

The executable suite is `tests/integration/hotel-content-c1b1.postgres.local.test.ts`. An earlier authorized attempt created and removed one disposable PostgreSQL container and volume, but its SQL identity probe did not complete; no migration or C1B1 acceptance test ran. The saved evidence contains only the caught Node `[eval1]` error line and no probe exit code or complete stdout/stderr. Do not interpret that attempt as a PostgreSQL connection failure or a pass. This runbook prepares a corrected probe for the next separately authorized run.

## Disposable target and required process variables

Create one new `postgres:17-alpine` container with a unique name and labels:

- `codex.task=hotel-content-c1b1-db-acceptance`
- `codex.run_id=<8-16 lowercase hex characters>`

Use one dedicated named volume `hotel-content-c1b1-<run-id>`, one fresh database `bazarbaaz_hotel_c1b1_<run-id>`, and one database user named `c1b1_test`. Publish a dynamically selected port only as `127.0.0.1:<port>:5432`. Keep all passwords and URLs in the current PowerShell process. Set `DATABASE_URL` and `DIRECT_URL` to the same loopback URL, including the generated database name and the `c1b1_test` username.

Before applying migrations, run `pnpm exec node scripts/db/hotel-content-c1b1-identity-gate.mjs`. The helper requires explicit process variables and performs two independent SQL reads: `psql` inside the exact task-owned container, and host-side `pg` using the exact `DATABASE_URL` that Prisma migrations and tests will use. It filters Docker container and volume discovery by both `codex.task=hotel-content-c1b1-db-acceptance` and the exact `codex.run_id`, then requires exactly one matching container and volume. It validates full container identity, image, run/task labels, volume attachment and a sole `127.0.0.1` binding; both SQL results must agree on `current_database()`, `current_user`, `current_schema() = public`, PostgreSQL major version 17, zero objects across the public schema's relation, routine, type, operator, operator-class/family, collation, conversion, and text-search catalogs, and no `_prisma_migrations`. The host probe uses `pg` resolved through the already-installed `@prisma/adapter-pg` dependency, sets no `.env` fallback, and prints no URL or credential. Any command error, empty or malformed output, resource ambiguity within this exact run, identity mismatch, nonempty schema, or existing ledger exits nonzero. Do not run a migration unless this helper prints a single PASS report and exits 0.

The earlier probe invoked `node --input-type=module -e $probe` from Windows PowerShell with Prisma Client `$queryRawUnsafe`. Prisma Client supports returning rows for a `SELECT`; the problem is that the probe used inline PowerShell argument passing and its wrapper failed to preserve the actual process exit code and complete stdout/stderr. The evidence therefore does not distinguish an invocation/quoting or output-parsing error from a connection error. `prisma migrate status` itself is not a general SQL query interface and is not used as an identity check.

After the identity gate passes, record the sorted migration directory names and assert 95 entries: the 94 committed C1A migrations followed by `20261013100000_hotel_website_operations_idempotency`. Run `prisma migrate status`, deploy only to this verified empty target, and run status again. The suite independently inspects Docker identity, the loopback binding, database identity, the full applied migration name list, success/rollback state, and empty synthetic-fixture tables before inserting fixtures. Abort on any mismatch.

Required process-only guards:

```powershell
$env:HOTEL_CONTENT_C1B1_PG_ACCEPTANCE = '1'
$env:HOTEL_CONTENT_C1B1_RUN_ID = '<run-id>'
$env:HOTEL_CONTENT_C1B1_CONTAINER_ID = '<exact-container-id>'
$env:HOTEL_CONTENT_C1B1_VOLUME_NAME = 'hotel-content-c1b1-<run-id>'
$env:AI_MEDIA_LOCAL_DOCKER_E2E = '1'
$env:DATABASE_URL = '<postgresql://c1b1_test:<secret>@127.0.0.1:<port>/bazarbaaz_hotel_c1b1_<run-id>>'
$env:DIRECT_URL = $env:DATABASE_URL
```

Do not store these values in `.env` files, shell profiles, persistent environment settings, or evidence logs.

## Offline identity-gate validation

The SQL gate has pure parsing and validation tests; they use synthetic output only and never start Docker or connect to PostgreSQL:

```powershell
pnpm exec node --test tests/unit/hotel-content-c1b1-identity-gate.test.mjs
```

Those cases cover valid output, empty output, invalid JSON/text, wrong database, wrong user, non-public schema, nonempty public schema, an existing migration ledger, wrong PostgreSQL major version, connection errors, and nonzero/unknown command status.

## Execute after authorization

```powershell
pnpm exec prisma migrate status
pnpm exec prisma migrate deploy
pnpm exec prisma migrate status
pnpm exec node --experimental-test-module-mocks --import tsx --require=./scripts/e2e/register-server-only.cjs --test tests/integration/hotel-content-c1b1.postgres.local.test.ts
```

The suite uses two synthetic HOTEL tenants with active `HOTEL_WEBSITE` and no `HOTEL_BOOKING` grants. It verifies persisted membership and SUPER_ADMIN scope checks, inactive users/memberships, cross-tenant/property/media rejection, draft and history behavior, independent review, self-approval prevention, publication/revocation, media eligibility changes, actor-bound idempotent replay, capability revocation before replay, audit-failure rollback, and an independent-connection same-key race. It also verifies all 95 expected migrations and refuses non-empty fixture tables. The unit/route tests separately verify authentication context, route-derived tenant/property identity, same-origin and idempotency-key guards, response cache controls, transition rules, self-approval, and actor-bound replay policy.

Additional release-gate concurrency cases to execute when authorized include parallel conflicting approvals, parallel distinct-revision publishes, publish/revoke races, different-key submissions against one revision, and bounded serialization retry exhaustion. Confirm each case has one legal winner and no orphan operation, review, publication, or audit records. Force audit failures for draft, review, publish, and revoke in isolated trigger-scoped transactions and verify complete rollback.

## Media reader contract and replacement gap

This milestone has no public editorial reader. A future C1B2 public reader must revalidate tenant ownership, current PUBLIC access, accepted MIME, eligible serving URL, and active property/room association on every request. Earlier draft, approval, or publication checks are not sufficient because Image eligibility can change.

Current replacement is revoke-then-publish. If publish fails after revocation, the page temporarily has no active publication. Do not change that behavior without review; a future atomic replacement operation could publish the verified approved revision and revoke the prior publication in one transaction.

## Cleanup

After tests and sanitized evidence are complete, inspect the exact task-labeled container again and remove only that container and its named disposable volume. Verify the exact container and volume are absent and the selected port is closed. Do not use Docker prune or broad cleanup commands. Clear process-local values when finished. This document does not grant authorization to create the target or execute the commands.
