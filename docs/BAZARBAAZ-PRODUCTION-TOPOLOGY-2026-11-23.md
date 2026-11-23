# Bazarbaaz current Production topology — 2026-11-23

**Authority:** latest explicit owner decision plus authenticated Runflare
console observations reported by Agent B. This **supersedes** historical
statements naming Neon or Vercel as Production authorities.

## Production resources

| Role | Verified identity | Evidence boundary |
| --- | --- | --- |
| Production hosting | **Runflare** | Owner confirmed |
| Runflare project | `product`, project ID `37622` | Authenticated console observed |
| Application service | service ID `87432` | Authenticated console observed |
| Production database service | **`maindb`**, service ID `87429`, PostgreSQL-PostGIS 17.3, active | Authenticated console observed; no SQL executed |
| Database connectivity features | internal networking available; remote access enabled | Metadata only; does not authorize connection |
| Current application database target | **UNVERIFIED** | Do not infer the active runtime binding from service co-location, old `.env` files or a green health endpoint |
| Source | `QComputer/shadcn-rtl`, `main` | Build SHA and deployed pod SHA must be separately proven |
| Guest hosts | `bazarbaaz.ir`, `damoon-hotel.ir` | Public routing is not database identity evidence |

**Neon is not Production.** Dated Neon project IDs, endpoint names,
branches and serverless adapter architecture remain historical source/tooling
evidence, not a license to query Neon for current Production.

**Render is unrelated** to this Production deployment. Do not enumerate
Render workspaces, applications, databases, logs or configurations for
Bazarbaaz or Damoon.

**Remote DB URI owner directive:** Every remote database connection must source
its URI **only** from environment variable `DB_REMOTE_URI`. Fail closed if it
is missing; never substitute `DATABASE_URL`, `DIRECT_URL`,
`BB_PRODUCTION_READONLY_URL`, an old Neon reference, or a literal URI.
`DB_REMOTE_URI` must not be printed, checked into Git, or treated as proof of
a correct target/authorization. The deployed application runtime binding
remains independently **UNVERIFIED**. See
`docs/BAZARBAAZ-REMOTE-DB-CONNECTION-CONTRACT-2026-11-23.md`.

**Vercel** preview failures from its suspended-preview policy do not
establish Runflare health or deployment status.

## Required database identity proof (non-mutating first)

Before any database inspection, the authorized operator must separately
verify: the current Runflare `product` project, `maindb` service `87429`,
the application service `87432` current runtime's *actual configured
database target* through redacted provider metadata, the approved
least-privilege reader, TLS requirements and exact scope. Do not publish
connection strings, secrets or credentials.

A healthy `/api/health?deep=1` means basic DB connectivity appeared healthy;
it **does not establish** that the runtime uses `maindb` service `87429`,
that the migration ledger is reconciled, or that booking is enabled.

The old Neon-specific Production inspection package is **quarantined**:
`docs/BB_PRODUCTION_READONLY_INSPECTION_PLAN.md`,
`scripts/ops/inspect-production-migration-metadata.mjs`,
`scripts/ops/production-migration-target.expected.json`, and related
attestation helpers must not be run against current Production without
a separately reviewed Runflare-specific safety adaptation. The separate
`scripts/audit/runflare-db-audit.mjs` is also quarantined: it reads a local
`.env` file, sets `ssl: false`, and has not been verified for current service
identity or least-privilege authorization. Do not run it against Production.

No database access, app configuration mutation, SQL, migration, credential
reading, restore or backup operation is authorized by this document.

## Damoon release and CMS

- PR148 live bundle/hash verified and static fallback categories
  **3 single / 17 double / 6 three-person suites / 3 four-person suites /
  2 five-person suites** (31 total).
- PR149 merged at `aa38b8c0a6a13de4b40cfe8b60ca7904be8349f7`.
  Runflare later showed deployment **Completed**, v128 active with 1/1 healthy
  pod, and the deployment log selected that exact SHA. PR149 was documentation-only;
  this does not establish new runtime behavior or dynamic CMS acceptance.
- Public CMS `/api/hotel/v1/website/properties/damoon?locale=fa`
  returned **HTTP 503 with Nginx HTML**. Its origin (proxy-generated,
  upstream response rewritten by proxy, or feature-gate interaction)
  is **UNCONFIRMED**.
- A disabled application gate would emit JSON `WEBSITE_DISABLED` / 503,
  which differs from the observed HTML. The active flag value and real
  production property slug are **not verified**.
- Public site acceptance has validated static fallback only; dynamic CMS
  public read, dashboard editing and publication in Production are
  **NOT ACCEPTED**. Isolated PostgreSQL CI acceptance is separate.
- Live guest requests, inventory creation, CMS writes and payment flows
  were **not executed** by these checks.

## Owner safety gates

**ON HOLD:** PR140, Production schema migrations, Production database
writes and inventory configuration, public booking/payments, and changing
feature flags or deployment settings solely to address 503.

**Allowed without mutation:** read-only provider metadata, safe GET/HEAD
browser/route checks, independently scoped code review and tests on
disposable PostgreSQL with synthetic fixtures.

## Documentation precedence

1. Latest explicit owner correction and verified provider metadata.
2. This current topology record plus matching dated owner-decision document.
3. Latest current-state / release register with exact SHA evidence.
4. Dated historical Neon and earlier migration reports (as history only).

The old Runflare migration reports describe what was observed on their
original dates. They must not be used as *current* service identity,
deployment readiness or Production SQL instructions.

See:
`docs/hotel/damoon/OWNER-DECISION-PRODUCTION-DATABASE-RUNFLARE-PRODUCT-2026-11-23.md`,
`docs/hotel/damoon/CMS-PRODUCTION-503-READ-ONLY-RUNBOOK-2026-11-23.md`,
`docs/hotel/damoon/PRODUCTION-NEON-HISTORY-AND-OPERATOR-QUARANTINE-2026-11-23.md`.
