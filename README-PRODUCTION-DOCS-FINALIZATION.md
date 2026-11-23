# Bazarbaaz / Damoon — Production documentation finalization (23 Nov 2026)

This is a **companion correction package** for the existing, unmerged branch
`codex/damoon-prod-db-authority-20261123`. It must NOT replace or erase that branch's
four existing owner-decision / CMS runbook documents.

**Owner-confirmed and independently observed in Runflare console (as reported by Agent B):**

- Current Production provider: **Runflare**.
- Project: **`product`**, ID **`37622`**.
- Application service: ID **`87432`**.
- Distinct database service: **`maindb`**, ID **`87429`**, active,
  PostgreSQL-PostGIS **17.3**.
- The actual app-to-database configuration/binding is **UNVERIFIED**. The fact
  that both services appear in one project does not independently prove the
  app's active database target.
- Neon: **NOT Production**; historical Neon work remains historical.
- Render: **UNRELATED** to Bazarbaaz/Damoon Production.
- Vercel preview: suspended/blocked; **not** the Production deployment authority.

**New owner directive:** Remote DB connection URIs must come **exclusively** from `DB_REMOTE_URI`, with fail-closed behavior and no fallback to `DATABASE_URL`, `DIRECT_URL`, `BB_PRODUCTION_READONLY_URL`, or old Neon tooling. This rule does not prove the application runtime connection or authorize a Production query. See `docs/BAZARBAAZ-REMOTE-DB-CONNECTION-CONTRACT-2026-11-23.md`.

**Current operational gates:** PR140, Production migrations and writes,
operational inventory, public booking/payment and uncontrolled feature-flag
changes remain **ON HOLD**. Dynamic public CMS GET returned proxy/Nginx HTML
503; 3/17/6/3/2 catalog acceptance was **static fallback**, not dynamic CMS
publication.

## What this package adds

- `docs/BAZARBAAZ-PRODUCTION-TOPOLOGY-2026-11-23.md`:
  current cross-project infrastructure authority and read-only boundaries.
- `docs/hotel/damoon/PRODUCTION-NEON-HISTORY-AND-OPERATOR-QUARANTINE-2026-11-23.md`:
  itemized historical-document / obsolete-inspection-tool audit.
- `docs/BAZARBAAZ-REMOTE-DB-CONNECTION-CONTRACT-2026-11-23.md`:
  mandatory `DB_REMOTE_URI`-only remote connection contract with fail-closed safeguards.
- A **guarded documentation-only script** that prepends current-authority or
  historical-only notices to selected existing documents. It does not rewrite
  their historical bodies, modify runtime code, or touch data.
- Manifest with SHA-256 for all payload files.

## Install into existing correction branch

1. Refresh Git. Check the exact current branch, HEAD, dirty state and other
   agents' work. DO NOT use a shared dirty checkout. Do not force-reset,
   cherry-pick or create another overlapping infrastructure PR.
2. Validate each listed payload SHA-256 and archive paths. Inspect ALL edits.
3. Extract to the *root* of an authorized clean checkout of the existing
   `codex/damoon-prod-db-authority-20261123` branch. Do not overwrite newer
   versions of same-named files; manually reconcile changed files.
4. If your tool/command policy does not authorize editing existing
   documentation, STOP, report `BLOCKED_BY_COMMAND_POLICY`, and use an
   explicitly authorized editing workflow. **Do not evade the rejection
   through a different tool or technique.**
5. When authorized:

```powershell
python scripts/docs/apply-bazarbaaz-runflare-production-docs-20261123.py
python scripts/docs/apply-bazarbaaz-runflare-production-docs-20261123.py --apply
python scripts/docs/apply-bazarbaaz-runflare-production-docs-20261123.py
git diff --check
```

The first and third commands must show anticipated edits / zero edits,
respectively. Backups are written under `.tmp/` (keep ignored).
No network or secrets are accessed by the script.

6. Review `git diff --name-status` and the *effective* branch-to-main diff.
   Keep PR documentation-only. Reconcile latest main instead of overwriting
   newer facts. Run appropriate doc and JSON validation.
7. Open a PR only after the core current-state, handoff, architecture,
   operator runbooks and legacy tools' prohibition are consistent.
   Do not merge while a Runflare deployment is in flight; do not initiate
   a duplicate deployment.
8. On merge, record exact PR head, merge SHA, provider status and any still
   unverified Production binding/503 diagnosis.

**Do NOT execute** `scripts/ops/inspect-production-migration-metadata.mjs`,
`production-migration-readonly-inspection.sql`, or their Neon-attestation
helpers for current Production. Those remain UNREVIEWED for Runflare `maindb`.
They require a separate safety review and scoped code fix, rather than a
docs-only search-and-replace. Do not scan or disclose credentials.

This v2 package **supersedes the earlier docs-finalization ZIP** (without `DB_REMOTE_URI`) and **supersedes the incorrect Neon-Production claim** from
`Damoon_Infrastructure_Documentation_Overlay_2026-11-23.zip` and corrects
the older emergency package's incomplete `maindb` service identification.
