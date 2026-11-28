# Damoon real-data import execution checklist

Baseline: `7225ef492a1d0a78f14b45b893c361115ca98407` on `kilo/damoon-real-data-01`.

- [x] M1 Strictly validate all 31 source unit records and eight tariff entries against the external staging schema. Explicit room-code-to-draft-ID reconciliation is still unresolved; no mapping is inferred.
- [ ] M2 Prisma/PostgreSQL 17 disposable database setup and existing migrations passed; read-only reconciliation reached its fail-closed scoped-property check because this database had no synthetic Damoon property/draft rows. Dry-run result is not yet accepted.
- [ ] M3 Implement tenant-scoped, transactional, idempotent apply; verify rollback and replay.
- [ ] M4 Preserve source amounts exactly as IRR and existing IDs, reservations, media, and VTour associations; retain unpublished state.
- [ ] M5 Verify isolation, ambiguous mappings, unresolved fields, precision, rollback, replay, and disabled publication.
- [ ] M6 TypeScript/lint/focused checks, self-review, commit, push, PR195 update, and hosted CI.

No production database, migration, deployment, publication, merge, or activation is authorized.

Latest validation: external source validator accepted 31 ordered, unique physical codes and eight tariff categories. Exact IRR-to-integer-TOMAN conversion is possible for single, triple_suite, quad_suite, royal, vip, and extra_service; `double_or_twin` and `quint_suite` are not exactly representable and must remain inactive. Read-only DB attempt used a task-owned temporary PostgreSQL 17 container at loopback port 55440, applied the 132 existing migrations, then refused because the expected scoped property was absent. The container was stopped and auto-removed. No rows were imported.
