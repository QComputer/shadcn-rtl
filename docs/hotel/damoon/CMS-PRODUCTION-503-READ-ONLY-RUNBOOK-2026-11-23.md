# Production CMS 503 — Runflare-only read-only diagnostic runbook

**State:** `ROOT_CAUSE_UNCONFIRMED`; **dynamic Production CMS:** `NOT_ACCEPTED`. This runbook permits observation only and does not authorize database access, feature activation, or deployment.

## Verified infrastructure boundary

Production hosting and PostgreSQL are on Runflare. Authenticated console verification identified Runflare project `product` (`37622`), application service `87432`, and a distinct active database service `maindb` (`87429`, PostgreSQL-PostGIS 17.3). The database service page showed internal service networking and remote access enabled. The actual application environment-to-database binding is not verified. Do not copy connection URIs, usernames, passwords, or host details into source control.

Neon is not the Production database. Render is unrelated. Do not inspect or query either provider for this incident.

## Evidence and current limits

- The previous CMS API probe for both `damoon` and `damoon-hotel` returned HTML HTTP 503 at the Nginx-facing endpoint. This does not prove the gate value, identify whether the proxy originated or transformed the response, or show a database fault.
- The public fallback catalog rendered 3/17/6/3/2 in FA/EN/AR; this is not dynamic CMS acceptance.
- The public gate `HOTEL_WEBSITE_PUBLIC_OPERATIONAL_ENABLED` must remain unchanged and unapproved for activation.
- The Production property slug, current gate state, application-to-database target binding, and exact upstream 503 cause remain unverified.

## Safe next steps

1. Refresh Runflare project/service state and deployment queue; do not start or duplicate a deployment.
2. Use only non-mutating GET/HEAD probes and correlate sanitized request IDs with Runflare application/proxy logs. Avoid unrelated tenant access logs.
3. Confirm the app-to-database binding through approved non-secret metadata without revealing values. If a database read is later explicitly authorized, reconfirm project `product` and database service `87429`, then use a read-only credential. Do not use the application service ID as the database ID.
4. Resolve the exact property slug only with that authorized read-only Runflare connection or signed read-only evidence. Never guess or alter Production identifiers.
5. Reproduce gate-on/gate-off and exact-slug HTTP behavior with disposable PostgreSQL. Do not bypass the gate to hide a 503.

No Production SQL, writes, migrations, feature changes, booking activation, or deployment was performed for this documentation correction.
