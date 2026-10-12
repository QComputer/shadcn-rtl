# HOTEL-CONTENT-C1A PostgreSQL acceptance plan

This suite is intentionally not run by the unit-test command. Run it only after explicit owner authorization to create one fresh disposable local database. It rejects a non-loopback target, a database name outside `bazarbaaz_hotel_c1a_<random>`, the wrong user, a non-PostgreSQL-17 server, a non-94-migration ledger, or any pre-existing tenant/content rows.

## Disposable target

Use `postgres:17-alpine`, a unique name such as `bazarbaaz-hotel-c1a-<random>`, the Docker label `codex.task=hotel-content-c1a-final-acceptance`, and a randomly selected free port bound only as `127.0.0.1:<port>:5432`. Use a random test password and the database/user names `bazarbaaz_hotel_c1a_<random>` and `c1a_test`. Keep connection values in the current PowerShell process only; never place them in `.env`, shell profiles, logs, or system environment settings.

Before migration, verify the exact container ID, task label, image, port binding, database name, schema `public`, role `c1a_test`, PostgreSQL major version 17, zero public tables, and absent `_prisma_migrations` table. Record the sorted migration-directory manifest and confirm the 92 committed R1 migrations precede the two C1A migrations. Abort on any mismatch.

## Commands after authorization

After the empty-target checks, set process-local `DATABASE_URL` and `DIRECT_URL` to the exact loopback database. Then run:

```powershell
pnpm exec prisma migrate status
pnpm exec prisma migrate deploy
pnpm exec prisma migrate status
pnpm exec prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code
$env:HOTEL_CONTENT_C1A_PG_ACCEPTANCE = '1'
pnpm exec tsx --require=./scripts/e2e/register-server-only.cjs --test tests/integration/hotel-content-c1a.postgres.local.test.ts
```

The acceptance file checks the migration ledger and empty-schema preconditions before inserting synthetic fixtures for two Hotel organizations. It covers capability opt-in, actual composite-key and check/unique constraints, media eligibility, service-created revisions, media ordering, publication approval/revocation, immutable snapshots, concurrent revision and publication operations, image deletion restriction, and a database trigger that forces audit insertion failure to verify transaction rollback. Fixtures contain only synthetic data.

## Cleanup

After evidence is saved, inspect the exact container ID and task label again. Stop/remove only that container. If an anonymous volume remains, identify it from that exact container's `.Mounts` before removing that exact volume. Verify the container and volume are absent and the assigned loopback port is no longer listening. Never use Docker prune commands or delete any other resource. Remove the process-local connection variables when the PowerShell process ends.

This plan does not authorize database creation or migration execution. Do not run the commands until a separate explicit authorization is received.
