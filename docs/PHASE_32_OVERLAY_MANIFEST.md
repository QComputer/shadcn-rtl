# Phase 32 overlay manifest — Database migration workflow

## Overlay file

`bazar-baz-phase32-database-migration-overlay.zip`

## Changed files

- `.env.example`
- `.gitignore`
- `package.json`
- `scripts/db/migrate-neon-data.ps1`
- `docs/PHASE_32_DATABASE_MIGRATION_OVERLAY.md`
- `docs/PHASE_32_OVERLAY_MANIFEST.md`

## Validation performed in sandbox

- `package.json` parses as valid JSON.
- Migration script was reviewed for secret-safe behavior.
- Overlay ZIP contains only changed files.

## Target validation required

Run on your Windows development machine from the project root:

```powershell
Expand-Archive -Force .\bazar-baz-phase32-database-migration-overlay.zip .
$env:OLD_DATABASE_URL='postgresql://OLD_USER:OLD_PASSWORD@OLD_HOST/OLD_DB?sslmode=require&channel_binding=require'
pnpm run db:migrate:neon:dry-run
pnpm run db:migrate:neon -- -ConfirmReplaceCurrentDb
pnpm run db:drift
pnpm run typecheck
pnpm run build
pnpm run quality:local
```
