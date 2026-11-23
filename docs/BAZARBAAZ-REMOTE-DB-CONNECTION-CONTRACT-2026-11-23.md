# Remote database connection contract — `DB_REMOTE_URI`

**Owner directive — 2026-11-23:** Any remote database connection performed for the
Bazarbaaz / Hotel Damoon project **must source its connection URI exclusively
from the environment variable `DB_REMOTE_URI`**. This is the canonical
remote-connection contract, including future explicitly authorized read-only
Production inspections and remote non-Production database inspections.

## Actual Production target

- Provider: **Runflare**. Project: **`product`** (`37622`).
- Production application service: `87432`.
- Separate PostgreSQL-PostGIS 17.3 database service: **`maindb`** (`87429`),
  active in the authenticated Runflare console according to Agent B.
- **Actual application-to-database runtime binding is NOT VERIFIED** and
  must not be inferred from the existence of the `maindb` service or the
  `DB_REMOTE_URI` variable.
- **Neon is NOT Production**; Render is unrelated to this project Production.

## Required behavior for authorized remote database tooling

1. Obtain the connection URI **only from `DB_REMOTE_URI`** in the approved
   execution environment. **Fail closed when missing or blank**. Do not fall
   back to `DATABASE_URL`, `DIRECT_URL`, `BB_PRODUCTION_READONLY_URL`,
   `POSTGRES_URL`, any Neon URI or any hardcoded value.
2. **Do not read or print the value** of `DB_REMOTE_URI` in logs, chat,
   CI output, screenshots, reports, test fixtures or committed files.
   Never store or print parsed credentials or the full URI. Environment
   variable *name* and a redacted, non-secret provider identity assertion
   may be recorded only when necessary.
3. Before connecting, confirm through **independent, non-secret authorized
   evidence** that the URI target corresponds to Runflare project `product`
   / database service `maindb` (`87429`), and verify actual application
   routing/binding separately. **Never guess based on the hostname alone.**
   `DB_REMOTE_URI` being set does not prove correct target identity.
4. Require an **explicit separate owner-authorized** scope and an adequately
   least-privilege reader, strict TLS/identity checks, read-only transactions
   and non-sensitive metadata queries for any Production read-only inspection.
   The URI variable does **not** authorize SQL execution on its own.
5. No Production writes, schema migrations, operational inventory changes,
   feature-flag activation, guest requests, booking/payment or PR140 merge.
6. Do not use the old Neon-attestation inspection tools against Production.
   Updating only the variable name is **not enough**: new guardrails and
   refusal tests are required in a separate code PR.

### Scope separation

`DB_REMOTE_URI` governs **remote database access initiated by operators,
inspection tooling or authorized remote-connect workflows**. It is **not
by itself proof** that the deployed application uses this variable for its
ordinary internal runtime connection. Determine that deployment contract
from sanitized Runflare service configuration and reviewed application code,
without accessing secret values. Do not silently rename or replace runtime
`DATABASE_URL` or other existing variables because of this directive.

### Read-only checks that do not connect

Documentation and code review may confirm the variable **name** exists in
its approved secret-management configuration. Do not fetch or disclose its
value. Do not run connection tests until all authorization and target-identity
conditions have been met.

**Status:** `OWNER_DIRECTIVE_REGISTERED`; `RUNFLARE_REMOTE_CONNECTION_NOT_EXECUTED`;
`PRODUCTION_DATABASE_TARGET_BINDING_UNVERIFIED`.
