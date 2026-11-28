# Damoon real-data import execution checklist

- [x] M1 Validate 31 unique physical codes and eight named IRR tariff entries. Nulls and source facts remain unchanged; no conversion silently rounds.
- [x] M2 Read-only scoped Prisma dry-run tested against 31 synthetic drafts. Historical `DRAFT-*` identifiers are hypothetical and are never treated as physical identity.
- [x] M3 Local-only serializable staging apply locks the property and rooms, stores exact source and proposal snapshots, checks reviewed physical attestations and optimistic timestamps, and supports exact replay. Synthetic PostgreSQL tests cover rollback and tenant isolation.
- [x] M4 Source IRR amounts and unresolved fields are retained in JSON staging; no tariff is activated. New physical codes and supersession remain proposals. Existing reservation-linked rooms and promoted drafts are preserved.
- [x] M5 Local synthetic tests exercise dependent rooms, ambiguous matches, physical verification, rollback, replay and disabled property state. Media dependencies are conservatively treated as blockers; external VTour absence requires explicit reviewed attestation.
- [ ] M6 Local focused tests, lint and scoped typecheck pass. Hosted real-data and TypeScript passed on candidate dc4aedb; migration-gap CI exposed a historical checkpoint assumption and its fix is under local rehearsal. Commit/push the fix and verify final-head hosted CI.

No production database access, import, migration, deployment, publication, merge or activation is authorized. Any actual reconciliation requires independently reviewed physical code and external-link attestations; unresolved records remain proposals.
