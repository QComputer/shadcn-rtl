# Damoon real-data import execution checklist

Baseline: `7225ef492a1d0a78f14b45b893c361115ca98407` on `kilo/damoon-real-data-01`.

- [ ] M1 Strictly validate the externally stored source records and reconciliation map.
- [ ] M2 Run a Prisma-backed database dry-run against an explicitly disposable PostgreSQL target.
- [ ] M3 Implement tenant-scoped, transactional, idempotent apply; verify rollback and replay.
- [ ] M4 Preserve source amounts exactly as IRR and existing IDs, reservations, media, and VTour associations; retain unpublished state.
- [ ] M5 Verify isolation, ambiguous mappings, unresolved fields, precision, rollback, replay, and disabled publication.
- [ ] M6 TypeScript/lint/focused checks, self-review, commit, push, PR195 update, and hosted CI.

No production database, migration, deployment, publication, merge, or activation is authorized.
