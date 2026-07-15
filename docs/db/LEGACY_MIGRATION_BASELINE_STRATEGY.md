# Legacy Migration Baseline Strategy

Date: 2026-07-16

## Status

The Production Prisma migration ledger is treated as immutable. The applied migration files that touch `ExportDataType` are mirrored in source by checksum:

- `20260628000300_export_hub_foundation`: `4974061a2ac04ba878d11b7ce20aec9f2bcc2f6ffd98adca69893cdee9ed58a3`
- `20260707000200_export_hub_extend_data_types`: `a024000331ef7d5383ac8043e618619470487911bb35d0662169a38c13465b68`

These files must not be edited into idempotent variants. In particular, `20260707000200_export_hub_extend_data_types` must not use `ADD VALUE IF NOT EXISTS` unless a future explicitly authorized migration-history correction changes the accepted strategy.

## Known Historical Replay Limitation

The checksum-correct historical chain is not replayable from an empty database:

1. `20260628000300_export_hub_foundation` creates `ExportDataType` with `CUSTOMERS` and `FANPAGE_POSTS`.
2. `20260707000200_export_hub_extend_data_types` adds `CUSTOMERS` and `FANPAGE_POSTS` again.
3. PostgreSQL raises duplicate enum label error `42710`.

This is a legacy ledger property, not an AI-media product behavior. It must remain documented rather than hidden by mutating applied migrations.

## Local Baseline Bootstrap

Hermetic local acceptance uses a guarded baseline bootstrap:

```powershell
pnpm run db:local-baseline:bootstrap
```

The bootstrap is allowed only for disposable local databases. It:

1. Refuses missing, unknown, Neon-like, or Production-fingerprinted database URLs.
2. Refuses production runtime settings and external side effects.
3. Applies the current Prisma schema to the local disposable database with `prisma db push`.
4. Marks source migration directories as applied locally with `prisma migrate resolve --applied`.
5. Runs `prisma migrate status` and requires the schema to be current.

The bootstrap never runs against Production and is not a substitute for Production migrations.

## Guardrails

- Production never uses this baseline bootstrap.
- Production `_prisma_migrations` is not edited.
- Production `prisma migrate deploy` is not part of hermetic acceptance.
- No seed, `db push`, or `migrate resolve` may run against Production through this path.
- The hermetic AI-media test provisions a disposable local PostgreSQL container by default and cleans it up afterward.
- `NEON_PROJECT_ID`, when present locally, is not documented, printed, or committed.
