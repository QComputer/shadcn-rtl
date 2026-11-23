<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: START -->
> **CURRENT PRODUCTION INFRASTRUCTURE — OWNER CONFIRMED, 2026-11-23:** Runflare project `product` (ID `37622`); application service `87432`; **Production PostgreSQL-PostGIS 17.3 `maindb` service `87429` (active, console observed)**. The application's actual database target/binding is still **UNVERIFIED**. **Neon is NOT Production; Render is unrelated.** All authorized remote DB connection URIs must come only from `DB_REMOTE_URI`, fail closed if missing, never log the value; this does not authorize a connection. Static Damoon 3/17/6/3/2 fallback is verified, but dynamic CMS GET returned Nginx HTML HTTP 503 and Production CMS publication remains unaccepted. PR140, Production writes/migrations, booking/payment and unapproved feature changes remain ON HOLD. Current reference: `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`. Historical Neon documents are not current operational authority.
<!-- BAZARBAAZ_CURRENT_PRODUCTION_TOPOLOGY_20261123: END -->

# Hotel schema readiness preflight runbook

This procedure captures an exact, non-mutating PostgreSQL snapshot for review
before any Hotel migration release. It does not authorize a Production change.

## Capture

1. Obtain the exact Runflare database endpoint and current serving revision from
   the approved operator channel. Use a dedicated least-privilege role with
   read-only catalog and ledger access. Do not place its URL or credentials in
   shell history, CI, or this repository.
2. Verify the target database and role shown by the query output. Execute
   `scripts/db/hotel-production-readiness-preflight-readonly.sql` with `psql`
   against that endpoint. The SQL opens a `READ ONLY` transaction, sets a
   statement timeout, records the exact Prisma ledger, Hotel operational object
   and enum state, and ends with `ROLLBACK`.
3. Save the unedited output in the restricted release evidence store. Compare
   the full ledger names/checksums/status/timestamps with the exact source SHA
   and compare the catalog results to each pending migration's SQL. Resolve
   every checksum divergence, rolled-back row, unfinished row and ordering
   inversion through the approved lineage process. Never edit historical SQL
   or ledger rows to make the comparison pass.
4. Independently capture the five pending migration file SHA-256 values from
   the exact release commit. They are listed in repository order in
   `MIGRATION-LINEAGE-RECONCILIATION-AND-REHEARSAL-2026-11-19.md`.

## Backup and rehearsal gates

- A read-only SQL snapshot cannot establish backup or point-in-time-recovery
  availability. Confirm the provider's retained backup/restore point and
  restore it into an isolated disposable PostgreSQL instance. Record the
  restore receipt, source point, target identity, and successful application
  health without copying secrets or guest data into this repository.
- Rehearse the exact migration sequence against a sanitized Production-lineage
  clone including the complete ledger and every divergent historical migration
  needed to construct that lineage. The existing current-source and affected-
  table-shape CI rehearsals are useful compatibility checks but do not replace
  this full clone.
- Verify existing guest/property/reservation rows, tenant constraints, request
  creation, inventory concurrency, reception confirmation, cancellation and
  payment reconciliation on the restored clone. Keep Hotel operational feature
  flags disabled throughout rehearsal.
- Prepare a forward recovery procedure and tested application rollback
  reference. These additive schema migrations are not safely undone by simply
  dropping their objects after the application has written data.

## Release decision

The release remains blocked until exact schema and ledger comparison is
resolved, the restore and full-lineage rehearsal pass, the designated owner
approves a maintenance window, and the deployment uses the reviewed migration
workflow. Do not run `prisma migrate deploy`, `migrate resolve`, ad hoc DDL or
ledger repair from this workstation. If any prerequisite is unavailable, leave
Production booking and payments disabled.
