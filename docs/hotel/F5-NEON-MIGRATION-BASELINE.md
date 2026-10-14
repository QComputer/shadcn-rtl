# Hotel F5 Neon staging and migration baseline — preparation only

Status: **blocked before Neon access, provisioning, database writes, or deployment**. This document is an operator plan and source inventory, not evidence of the current Production schema or migration ledger.

## Environment boundary

- Intended database platform: the existing Bazarbaaz Neon project `aged-star-89488704`; no Render work is part of this plan.
- Production references supplied by the owner (`br-small-queen-aii58cw9`, endpoint `ep-little-river-aifwxtf7`, database `neondb`) are identity references only. This task did not connect to them.
- F5 must use a separately identified schema-only **root** branch. It is not to be treated as a normal child branch or as preserving the Production Prisma ledger. Neon’s current docs state schema-only roots have plan-specific root allowances (Free 3, Launch 5, Scale 25) and schema-only storage caps (1/3/20 GB respectively). The actual account plan, entitlement, current root count and available storage must still be confirmed in the Neon account before creation.
- Vercel must use a distinct F5 staging project/environment and a verified SSO-protected deployment. No Vercel configuration was changed.
- Synthetic tenant, role, content, media and domain data only. Do not clone Production rows or credentials.
- `HOTEL_WEBSITE_PUBLIC_OPERATIONAL_ENABLED` may only be enabled in authorized F5 staging for a bounded acceptance window. `HOTEL_BOOKING`, anonymous holds, payments, SMS/notifications and other operational business flows remain disabled.

## Source migration inventory

The checked-out F4 source contains **95** ordered directories under `prisma/migrations`. Each directory's `migration.sql` byte hash is emitted by the read-only script `node scripts/hotel/f5-migration-inventory.mjs`. The current source has no evidence here of the live Production `_prisma_migrations` rows, applied checksums, failed rows, or schema drift.

Hotel-specific migration directories in this source include:

| Migration | Change area |
|---|---|
| `20261003060000_add_organization_vertical_and_hotel_booking_capability` | Hotel vertical and booking capability foundation |
| `20261003070000_add_hotel_persistence` | Hotel properties, rooms, rates and reservations |
| `20261004080000_add_hotel_management_fields` | Management metadata and constraints |
| `20261004090000_add_hotel_rate_plan_cancellation_policy` | Rate plans and cancellation policy |
| `20261004100000_add_hotel_inventory_idempotency` | Inventory idempotency |
| `20261004110000_add_hotel_publication_approvals` | Publication approvals |
| `20261004120000_add_hotel_anonymous_hold_idempotency` | Anonymous hold idempotency/snapshots |
| `20261012130000_add_hotel_website_capability` | Separate `HOTEL_WEBSITE` capability |
| `20261012140000_hotel_website_content_foundation` | Editorial revisions, review, publication and media associations |
| `20261013100000_hotel_website_operations_idempotency` | CMS operation idempotency |

These names are source facts only. They do not assert that these are the only migrations pending in Production or staging.

## Safe read-only Production reconciliation, before branch creation

1. Obtain a separately authorized Neon read-only identity scoped to the Production branch/database; never use an owner/write URL in the staging process. Keep the URL in the approved secret manager and do not print it.
2. Verify server-reported project, branch, endpoint, database and role identity from a read-only connection. Verify the expected Production endpoint and `current_database() = 'neondb'`; stop on any mismatch.
3. Read only the `_prisma_migrations` columns needed for migration name, checksum, start/finish and rollback status; compare each applied name/checksum with local migration files. Do not query application rows or copy customer data.
4. Capture a schema-only inventory/diff of tables, columns, constraints, indexes, enums, extensions and triggers. Compare it with this F4 source schema and the accepted F5 commit. Record pre-existing drift; do not reconcile Production or mutate it.
5. Save a redacted, reviewed baseline report containing identifiers and migration metadata, not database credentials or row data.

## Staging baseline reconciliation — no blind `migrate deploy`

1. Confirm in Neon account UI/API the project plan, schema-only root-branch availability and eligibility, root-branch count/limits, endpoint limits, storage/compute quotas, and any spend alerts. Public pricing is not the account's plan or remaining allowance.
2. Create only the separately authorized schema-only root branch, after identity and cost review. Verify its branch/endpoint/database IDs and confirm there are no Production application rows or credentials. Schema-only branching does **not** guarantee `_prisma_migrations` rows are present.
3. Inspect the branch's schemas and migration ledger read-only before any migration. If it contains copied application tables but an empty/missing Prisma ledger, do not run the 95 migrations against that schema: the migration runner could attempt duplicate DDL.
4. Preferred safe target: use a distinct, verified-empty staging database on the isolated branch if Neon supports it and the operator confirms the new database starts empty. Verify `current_database`, role, branch/endpoint identity, schemas, relations, and empty migration ledger before writes. Then compare the Production migration ledger and staging source migration hashes and run only a reviewed migration plan matching the accepted application commit.
5. If Neon cannot provide a truly empty database in that root, stop and obtain a reviewed baseline-stamping/reconciliation plan. Never `migrate resolve --applied` wholesale, manually copy ledger rows, drop/recreate an unverified schema, or apply all 95 migrations to an existing copied schema.
6. After a migration plan is approved, create a least-privilege staging application role and separate migration role; scope both to the staging database only. Keep pooled/runtime and direct/migration connection strings in separate Vercel staging-only secret settings.
7. Provision the synthetic F5 tenant, independent author/reviewer/manager accounts, tenant-owned public PNG test asset, foreign-tenant media negative fixture, test domains and active `HOTEL_WEBSITE` capability using reviewed staging-only procedures. No fixture contains a Production record or credential.
8. Configure the F5 Vercel project with SSO protection, staging-only secrets, public Website gate enabled only for the test window, and booking/holds/payments/notifications off. Verify environment scoping before the first deployment.

## Cost and entitlement notes (not account-verified)

Neon's current public pricing page lists Free at $0 with 100 CU-hours per project/month and 1 GB project storage, Launch at $0.106/CU-hour and $0.35/GB-month, and Scale at $0.222/CU-hour and $0.35/GB-month. The comparison lists Free/Launch/Scale root allowances of 3/5/25 for schema-only branches; ordinary included branch counts and extra-branch charges are separate pricing dimensions. Actual F5 cost depends on this project's plan, root allowance usage, compute runtime/size, storage/history and account entitlements. No project billing or usage data was accessed, so the F5 branch cost cannot yet be quoted. Recheck pricing and quotas immediately before provisioning.

## Exact owner/operator actions still required

- Grant a scoped Neon project read-only inspection credential or run the listed read-only reconciliation in the Neon console and return the redacted migration/schema report.
- Confirm the account plan, schema-only root branch entitlement and available branch/compute/storage limits; approve any expected usage charge.
- Approve a separately scoped F5 staging branch and an empty-database strategy after the migration comparison.
- Provision/authorize the F5 staging-only Vercel project, protected hostname, secret-store entries, and synthetic accounts/media/domain fixtures.
- Authorize the bounded staging-only migration and browser acceptance window after the above checks; this preparation has not used that authorization to create resources or write data.

## Browser suite contract

The synthetic fixture specification is exported as `syntheticFixtureRequirements` in `tests/e2e/hotel-f5/synthetic-fixtures.mjs`: two active synthetic Hotel tenants with separate staging hosts and `HOTEL_WEBSITE` enabled but `HOTEL_BOOKING` disabled; a third synthetic tenant with website capability disabled; distinct ADMIN author and ADMIN reviewer, MANAGER and foreign-tenant ADMIN; target-owned synthetic PUBLIC PNG; foreign-tenant image and a foreign published association ID; and synthetic-only content. No real Hotel brand, Production record, credential, or photography may be used.

The dedicated suite is `tests/e2e/hotel-f5/staging-cms-acceptance.spec.mjs`, configured by `playwright.hotel-f5.config.mjs`. It requires process-only variables (never commit an env file): `HOTEL_F5_E2E_ENABLED=1`; staging HTTPS app/public URLs; Vercel SSO-only storage state; synthetic target and foreign organization/property IDs and slugs; distinct ADMIN author and ADMIN reviewer credentials plus MANAGER and foreign-tenant credentials; target-owned synthetic public PNG image ID; foreign-tenant image ID and published association ID; a unique `F5-SYNTHETIC-...` fixture tag; public-gate-on F5 deployment and separate gate-off/unknown/inactive/foreign/capability-disabled API URLs; explicit confirmations that booking, payment, and notification gates are off.

The test rejects non-F5/staging hosts, the named Production domains, missing SSO state, missing role fixtures, equal author/reviewer identity, equal target/foreign image IDs, absent gate confirmations, or a missing feature-gate opt-in before launching browser interactions. It first probes the deployment in a no-cookie browser context and requires SSO redirection or an access-denied response. The Vercel state file should contain only staging SSO access state, not an application user session; credentials and state files remain operator-managed and outside Git. Run only after synthetic staging fixtures are provisioned:

```powershell
pnpm exec playwright test --config=playwright.hotel-f5.config.mjs
```

No Playwright acceptance run is claimed by this preparation. The gate-off URL targets a separate isolated deployment/configuration where the public website flag is off; the main workflow uses the staging-only gate-on deployment to exercise publish/view/revoke. The CMS workflow creates only synthetic editorial revisions and a synthetic-labeled public test image association, rejects a foreign image before persistence, tests independent review and manager/foreign-tenant denials, verifies the public association-ID media endpoint, and revokes the synthetic publication. Test cleanup attempts a reviewer-authorized revoke if a failure occurs after publication.
