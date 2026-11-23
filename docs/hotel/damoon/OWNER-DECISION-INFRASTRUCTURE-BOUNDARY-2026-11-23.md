# Owner decision: Production infrastructure boundary

**Date:** 2026-11-23. **Authority:** direct owner confirmation. **Scope:** Bazarbaaz and Hotel Damoon Production.

## Confirmed providers and service identity

- Production application hosting is Runflare.
- Production PostgreSQL is Runflare in the project named `product`; Neon is not Production. Render is unrelated to Bazarbaaz and Hotel Damoon and must not be queried or used as Production evidence.
- Read-only verification in the authenticated Runflare console identified project `product` (`37622`), application service `87432`, and a distinct active database service `maindb` (`87429`), reported as PostgreSQL-PostGIS 17.3. The service IDs were independently observed; never infer the database service ID from the application service ID.
- The database service page showed internal service networking and remote access enabled. Connection URIs, usernames, passwords, and host details must remain in Runflare and must not be copied into Git. The application's actual environment-to-database binding was not inspected and remains unverified. No database connection or SQL was used during this check.

## Operational gates

1. Use only the verified Runflare `product` database service for future Production database investigation, after reconfirming exact project and service identity and the application connection path. Database access must be explicitly authorized and read-only.
2. Do not query Neon or Render for Production diagnostics.
3. Production writes, migrations, operational inventory changes, feature-gate changes, booking, and payments remain `ON_HOLD` or disabled. PR140 remains `ON_HOLD`.
4. Healthy endpoints do not establish schema lineage or dynamic CMS publication acceptance.

## CMS incident status

A prior public CMS GET returned HTML HTTP 503 for both `/properties/damoon` and `/properties/damoon-hotel`. This does not establish the public feature-gate value, the origin or transformation of the proxy response, or a database fault. Static fallback display remains accepted; dynamic Production CMS read, edit, and publication remain `NOT_ACCEPTED` until independently verified. Do not enable the public CMS gate to diagnose the issue.
