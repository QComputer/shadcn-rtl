# CMS public API 503: local source triage

Date: 2026-11-23

Source baseline: `aa38b8c0a6a13de4b40cfe8b60ca7904be8349f7`
Scope: source inspection and local route tests only. No Production database,
Runflare configuration, feature flag, or guest/content record was accessed.

## Findings

- `lib/hotel/services/public-website-gate.ts` enables public CMS reads only when
  `HOTEL_WEBSITE_PUBLIC_OPERATIONAL_ENABLED` equals `1`.
- The website, room-category, and media route handlers check this gate before
  invoking their database-backed services. When disabled, they return the
  application response `503` with JSON `{ error: "WEBSITE_DISABLED", ... }`,
  `Content-Type: application/json`, and `Cache-Control: no-store, max-age=0`.
- When enabled, a service exception in the property route is caught and mapped
  to JSON `500` with `{ error: "UNAVAILABLE" }`. A malformed locale or slug is
  rejected as JSON `400` before the service call.
- The standalone public script requests property slug `damoon`; the public CMS
  service performs an exact active `HotelProperty.slug` match. Historical
  reconciliation records mention `damoon-hotel`, but the Production property
  slug remains unverified. No alias or Production identifier change is made.
- The previously observed HTML Nginx `503` is not produced by these route
  handlers in focused local tests. Its Production origin remains undetermined;
  local source tests do not establish whether a live proxy, upstream, or
  deployment condition generated that response.

## Acceptance evidence

- `tests/unit/hotel-website-public-routes.test.ts`: 6/6 passed. This includes
  the gate-off JSON 503/no-database-call contract and a synthetic service
  failure returning no-store JSON 500.
- Disposable-PostgreSQL acceptance was not run: Docker was not running, and
  this task did not start it. No Production connection was attempted.
- Dynamic CMS publication and Production property-slug resolution remain
  unverified. The static fallback remains a separate path.

## Safe database-audit tooling

`scripts/audit/runflare-db-audit.mjs` now reads a URI only from
`process.env.DB_REMOTE_URI`, requires explicit disposable-local read-only
authorization, and refuses every non-loopback target and every database or
role outside the C1B2 disposable fixture contract. It no longer reads `.env`,
prints connection details, enumerates business records, or writes a report
file. Unit tests use a synthetic URI and a mocked client; no database was
contacted.

This is local implementation evidence only. It does not prove the Production
Nginx `503` is resolved, identify the live feature-gate value, verify the live
property slug, or establish Production CMS acceptance.
