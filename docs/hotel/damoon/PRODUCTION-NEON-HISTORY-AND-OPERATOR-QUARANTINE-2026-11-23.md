# Current Runflare database versus historical Neon documents — audit

**Date:** 2026-11-23. **Status:** docs-only correction inventory.
This document does not rewrite, discard or erase the historical Neon
migration events. It prevents historical assumptions from being used as
current operational instructions.

## Confirmed current identity

Runflare project `product` / `37622`; application `87432`;
database service **`maindb` / `87429`**, active PostgreSQL-PostGIS 17.3,
as reported from the authenticated console. The **app-to-DB runtime binding
remains UNVERIFIED**. Neon is NOT Production. Render is UNRELATED.

**Remote access directive:** The only source for any authorized remote DB
connection URI is environment variable `DB_REMOTE_URI`; do not fall back to
Neon, `DATABASE_URL`, `DIRECT_URL`, `BB_PRODUCTION_READONLY_URL` or hardcoded
URIs. This is a future tooling contract and does not authorize access. See
`docs/BAZARBAAZ-REMOTE-DB-CONNECTION-CONTRACT-2026-11-23.md`.

## Documents and tools needing explicit precedence

| Path | Treatment | Why |
| --- | --- | --- |
| `docs/CURRENT_SOURCE_OF_TRUTH.md` | Historic narrative preserved; top-of-file current-authority banner | July/August sections say Neon Production |
| `docs/NEXT_PHASE_ROADMAP.md` | Preserve history, prepend current authority | May contain prior deployment or database plan |
| `docs/INCIDENT_REPORT_20260815.md` | Historical evidence only | Prior incident does not establish current provider |
| `docs/migration/runflare/DATABASE-TOPOLOGY-VERIFICATION-REPORT.md` | Explicitly timestamped snapshot (2026-10-31) | Says Neon authoritative and old Runflare DB empty, contradicts current owner confirmation |
| `docs/BB_PRODUCTION_READONLY_INSPECTION_PLAN.md` | **UNSAFE FOR CURRENT PRODUCTION; DO NOT EXECUTE** | Plan requires Neon project/branch/endpoint attestation |
| `docs/hotel/F5-CLOUD-ACCEPTANCE-PLAN.md` | Historical staging-only plan | Contains Neon Production assumptions |
| `docs/hotel/F5-NEON-MIGRATION-BASELINE.md` | Historical/Neon staging-only | Neon root/branch procedure is not current Production |
| `docs/database/NEON_*.md` | Legacy architecture/policy docs; archive-context banner | Some remain useful as source history; not current Production attestation |
| `scripts/ops/production-migration-target.expected.json` | **UNREVIEWED, NOT CURRENT PRODUCTION** | Expected Neon identities; do not edit by string replacement |
| `scripts/ops/inspect-production-migration-metadata.mjs` | **UNREVIEWED, DO NOT RUN ON PRODUCTION** | Remote target guard may bind Neon assumptions |
| `scripts/ops/production-migration-readonly-inspection.sql` | **UNREVIEWED, DO NOT RUN ON PRODUCTION** | Identity checks may reflect old target |
| `scripts/audit/runflare-db-audit.mjs` | **QUARANTINED; DO NOT RUN ON PRODUCTION** | Uses `DB_REMOTE_URI`, but configures `ssl: false`, loads a local `.env` file, and has not been verified for target attestation and least-privilege authorization |
| `docs/hotel/damoon/READ-ONLY-PRODUCTION-PREFLIGHT-RUNBOOK.md` | Update current topology/gate before use | Must require service 87429 identity + verified app binding |
| `docs/hotel/damoon/CURRENT-STATE-2026-11-23.md` and release register | Update current topology and uncertainty | PR149 docs and provider target are different evidence |

**Never mass-replace all occurrences of “Neon”.** Library skills,
tests, migrations, provider integration code and historical CI transcripts
may reference it correctly. The current provider change does not
automatically prove the implementation no longer uses legacy Neon
drivers or environment variables; investigate these separately.

## Follow-up code safety task, NOT part of docs PR

A separate reviewed engineering PR must either replace the Neon-specific
Production inspection tooling with **strict, fail-closed Runflare `maindb`
identity attestation**, or explicitly disable it pending redesign.

Required independently checked preconditions: actual app DB target,
role/TLS/least privilege, redacted runtime attestation, database/schema
identifiers, permission gate, and test fixtures proving refusal to run
against Neon or an unknown remote DB.

No Production credential inspection, connection, query or migration has
been authorized by this document.

## Gate interpretation

The public Damoon catalog being visible via static fallback does not
prove successful CMS publication. Its Nginx HTML 503 is not proof of DB
failure or feature gate state. Keep `DYNAMIC_CMS_PRODUCTION_ACCEPTANCE`
at `NOT_ACCEPTED` until independently tested under authorized controls.
