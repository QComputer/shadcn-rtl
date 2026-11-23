# Production database source of truth — Runflare `product`

**Owner decision:** 2026-11-23. **Authority:** latest explicit owner correction. **Status:** owner identity confirmed; provider resource independently verified read-only.

## Production identity

- Application: Runflare project `product` (`37622`), application service `87432`.
- PostgreSQL: Runflare project `product` (`37622`), distinct service `maindb` (`87429`), PostgreSQL-PostGIS 17.3, shown active in the Runflare console.
- Service IDs are distinct. Never infer a database ID from the application service ID.
- The database service page showed internal service networking and remote access enabled. Do not store connection URIs, usernames, passwords, or host details in Git. The application's configured target binding was not inspected; it remains unverified.
- Neon is **not** Production. Render is unrelated to Bazarbaaz/Damoon Production. Do not query either provider for Production diagnostics.

## Release and change boundary

This verification used provider metadata only. No database connection, SQL query, write, migration, configuration change, feature-flag change, deployment, guest request, booking, or payment occurred. Use only service `87429` for future explicitly authorized, read-only Production database inspection after confirming the app connection path without exposing secrets.

PR140 and Production migrations remain `ON_HOLD`; operational inventory changes, public booking, and payments remain disabled.

## CMS incident

The previous public CMS GET returned Nginx-facing HTML HTTP 503 for both candidate property slugs. That does not establish whether Nginx generated or transformed the response, the application feature-gate value, or a database fault. The 3/17/6/3/2 public catalog was observed through static fallback. Dynamic Production CMS read/edit/publication remains `NOT_ACCEPTED`.
