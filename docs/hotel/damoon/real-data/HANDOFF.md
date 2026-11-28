# Damoon real-data import — incomplete handoff

This work is intentionally incomplete. M1 source validation has been locally verified against the external staging files; M2 is not accepted and no import capability is accepted.

- Branch: `kilo/damoon-real-data-01`; PR: https://github.com/QComputer/shadcn-rtl/pull/195
- Source package (preserved outside Git): `C:\Users\disso\damoon-real-data`
- Implemented partial files: `scripts/hotel/damoon-real-data-import.mjs`, `docs/hotel/damoon/real-data/EXECUTION-CHECKLIST.md`.
- Retired partial dependency tree was removed; primary checkout dependencies were reused. A task-owned loopback PostgreSQL 17 container on port 55440 applied all 132 existing migrations and was stopped/auto-removed. No application rows were imported.
- Source validator accepted 31 uniquely coded unit rows and eight tariff rows. `double_or_twin` and `quint_suite` IR amounts cannot be represented exactly in integer TOMAN; keep them inactive. Other rates remain staging-only and inactive.
- Prisma read-only dry-run failed closed because the disposable database had no scoped synthetic property/draft fixtures. The current staging documents do not map physical unit codes to existing draft IDs. Do not infer those mappings.
- Remaining: create only a proven synthetic property/draft fixture for dry-run; supply/derive a reviewed explicit source-code-to-draft-ID mapping without guessing; implement transaction/idempotency and rollback/replay only after mapping; preserve unresolved fields, tariff exactness, existing IDs, reservations, media and VTour associations; focused regression/TS/lint, commit, push, and hosted CI.
- Do not use Production. Do not modify Codex 1's separate environment. Do not merge PR195.

The current source JSON is deliberately external and must be read from the path above. This handoff does not copy or commit it.
