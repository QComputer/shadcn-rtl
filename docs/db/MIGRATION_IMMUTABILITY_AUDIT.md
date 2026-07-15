# Migration Immutability Audit

Date: 2026-07-16

## ExportDataType Audit Result

The `ExportDataType` migration audit found two source migrations:

- `20260628000300_export_hub_foundation`
- `20260707000200_export_hub_extend_data_types`

Production read-only `_prisma_migrations` checks showed one successful record for each migration. The current source checksums match the Production checksums after restoring `20260707000200_export_hub_extend_data_types` to its applied bytes.

## Checksums

| Migration | Production checksum | Source status |
| --- | --- | --- |
| `20260628000300_export_hub_foundation` | `4974061a2ac04ba878d11b7ce20aec9f2bcc2f6ffd98adca69893cdee9ed58a3` | Matches |
| `20260707000200_export_hub_extend_data_types` | `a024000331ef7d5383ac8043e618619470487911bb35d0662169a38c13465b68` | Matches |

## Decision

Applied migrations remain immutable. The non-replayable historical chain is handled only by the guarded local baseline bootstrap for disposable acceptance databases.

No Production migration command, `_prisma_migrations` mutation, manual SQL, seed, Blob operation, AI-media job, or real generation was authorized by this audit.
