# Phase 32 — Safe Neon-to-current database data migration overlay

## Purpose

This overlay adds a repeatable, secret-safe migration workflow for moving data from an old Neon/PostgreSQL database into the database currently configured in the project's local `.env` file.

The migration is designed for the current Bazar Baz repository and keeps the current Prisma schema as the source of truth.

## Files changed

- `package.json`
  - Adds `db:migrate:neon`
  - Adds `db:migrate:neon:dry-run`
- `scripts/db/migrate-neon-data.ps1`
  - Backs up the current destination DB.
  - Dumps old source DB data only.
  - Resets the destination `public` schema.
  - Applies the current Prisma migrations.
  - Restores old data into the current migrated schema.
  - Runs `pnpm run db:drift` after restore.
- `.env.example`
  - Documents `DATABASE_URL_UNPOOLED` and migration-only `OLD_DATABASE_URL` placeholder.
- `.gitignore`
  - Ignores DB backup/dump artifacts.

## Safety rules

1. Do not commit real DB URLs or old Neon credentials.
2. Provide the old source URL only through the terminal environment variable `OLD_DATABASE_URL`.
3. Run dry-run first.
4. Only run the destructive replacement command after a current destination backup has been created successfully.
5. Rotate the old exposed Neon password after the migration is complete.

## Required local tools

```powershell
pg_dump --version
pg_restore --version
psql --version
pnpm --version
```

If PostgreSQL commands are missing, install PostgreSQL client tools and reopen PowerShell.

## Apply the overlay

From the project root:

```powershell
Expand-Archive -Force .\bazar-baz-phase32-database-migration-overlay.zip .
```

## Migration commands

Set the old source URL only in the current PowerShell session:

```powershell
$env:OLD_DATABASE_URL='postgresql://OLD_USER:OLD_PASSWORD@OLD_HOST/OLD_DB?sslmode=require&channel_binding=require'
```

Run a dry-run first:

```powershell
pnpm run db:migrate:neon:dry-run
```

Run the real migration:

```powershell
pnpm run db:migrate:neon -- -ConfirmReplaceCurrentDb
```

Run final checks:

```powershell
pnpm run db:drift
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

If the known drift validator fails for the previously documented safe additive columns:

```powershell
pnpm run db:repair:known-drift
pnpm run db:drift
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Rollback command

The migration creates a backup under `db-backups/current-before-neon-data-migration-*.dump` before replacing the current DB.

To rollback, pick the exact backup file and run:

```powershell
$DST_DB_URL = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL_UNPOOLED=' } | Select-Object -First 1) -replace '^DATABASE_URL_UNPOOLED=', ''
if (-not $DST_DB_URL) {
  $DST_DB_URL = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=', ''
}

psql $DST_DB_URL -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
pg_restore --dbname $DST_DB_URL --no-owner --no-acl --single-transaction .\db-backups\current-before-neon-data-migration-YYYYMMDD-HHMMSS.dump
```

## Notes

- The script restores data only, not the old schema. The current Prisma migrations create the destination schema.
- If restore fails because the old data does not match the current Prisma schema, keep the generated dumps and share the exact `pg_restore` error.
- Do not run `pnpm run db:seed` after migration unless you intentionally want to add demo data.
