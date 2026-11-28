# Damoon real-data import — incomplete handoff

This work is intentionally incomplete and unverified. It is transferred to the primary Codex agent; do not treat it as accepted M1/M2 or usable import capability.

- Branch: `kilo/damoon-real-data-01`; PR: https://github.com/QComputer/shadcn-rtl/pull/195
- Source package (preserved outside Git): `C:\Users\disso\damoon-real-data`
- Implemented partial files: `scripts/hotel/damoon-real-data-import.mjs`, `docs/hotel/damoon/real-data/EXECUTION-CHECKLIST.md`.
- Frozen install attempted with pinned Node 24.x and pnpm 10.15.0; install did not complete. Prisma client is absent; client generation and DB dry-run were not successful.
- No database was provisioned or modified. No apply mode, M3–M6, tests, or CI evidence exists.
- Remaining: finish locked dependency install/client generation; provision dedicated loopback disposable PostgreSQL 17; validate fixtures and source-to-draft mapping; complete read-only DB reconciliation; implement transactional tenant-scoped idempotent apply with rollback/replay tests; preserve unresolved fields, IRR precision, IDs, reservations, media and VTour associations; verify publication remains disabled; focused checks, review, CI and PR update.
- Do not use Production. Do not modify Codex 1's separate environment. Do not merge PR195.

The current source JSON is deliberately external and must be read from the path above. This handoff does not copy or commit it.
