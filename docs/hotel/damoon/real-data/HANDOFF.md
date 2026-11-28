# Damoon real-data import — staging implementation

PR195 remains unmerged and production operations are not authorized. The management source supersedes the historical assumed inventory classification; hypothetical `DRAFT-*` identifiers are not physical room identities.

The local-only importer validates the 31 unit and eight tariff source entries, provides a scoped read-only dry-run, and atomically stores an exact source/proposal snapshot. No real source package is committed. Missing physical codes become creation proposals; unpromoted historical drafts become supersession proposals; both require further reconciliation and are not automatically created, archived or published. A room is updated only when an optional reviewed verification names its exact physical code and ID, pins its timestamp, explicitly confirms no external dependencies, and the database reports no reservation, maintenance or room-type media links. All other existing rooms are preserved for review. No category matching, row-order matching or unverified draft mapping is used.

The source amounts remain exact IRR in the staging snapshot. `double_or_twin` and `quint_suite` are not exactly representable as integer TOMAN. No tariff, publication, room sale or booking gate is activated. The CLI requires the existing guarded disposable PostgreSQL target even for `--apply`; it refuses Production.

Synthetic PostgreSQL acceptance covers dry-run, rollback, tenant isolation, dependency preservation and idempotent replay. Additional operator review must establish any real physical-code attestations and external VTour links; this package neither inspects Production nor claims such evidence. See EXECUTION-CHECKLIST.md and PR history for current CI evidence.
