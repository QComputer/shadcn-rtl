# Neon Runtime Validation Report

Date: 2026-07-15

## Scope

DB-NEON-01 changes database connection architecture only. It does not apply pending production migrations and does not mutate application data.

## Required Commands

```powershell
pnpm install --frozen-lockfile
pnpm run db:generate
pnpm run db:validate
pnpm run quality:neon-serverless-runtime
pnpm run test:neon-serverless-runtime
pnpm run db:neon:check
pnpm exec prisma migrate status
pnpm run quality:b2b-guided-tenant-provisioning-readiness
pnpm run quality:b2b-business-onboarding-wizard
pnpm run quality:b2b-request-demo-leads
pnpm run quality:b2b-custom-domain-onboarding
pnpm run quality:source-baseline
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run typecheck
pnpm run lint
pnpm run build
git diff --check
```

## Results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed | Lockfile was already satisfiable. |
| `pnpm run db:generate` | Passed | Prisma Client generated with Prisma 6.19.3. |
| `pnpm run db:validate` | Passed | Prisma schema validated with `DIRECT_URL` configured locally. |
| `pnpm run quality:neon-serverless-runtime` | Passed | Source validator confirmed the Neon adapter runtime boundary and policy checks. |
| `pnpm run test:neon-serverless-runtime` | Passed | Focused source tests for the Neon Serverless runtime passed. |
| `pnpm run db:neon:check` | Passed | Pooled runtime connectivity, read-only Prisma query, and migration metadata read passed without printing credentials. |
| `pnpm exec prisma migrate status` | Executed | Read-only status check found pending migrations; no migrations were applied. |
| `pnpm run quality:b2b-guided-tenant-provisioning-readiness` | Passed | Existing P13 validator still passes. |
| `pnpm run quality:b2b-business-onboarding-wizard` | Passed | Existing B2B onboarding validator still passes. |
| `pnpm run quality:b2b-request-demo-leads` | Passed | Existing request-demo lead validator still passes. |
| `pnpm run quality:b2b-custom-domain-onboarding` | Passed | Existing custom-domain onboarding validator still passes. |
| `pnpm run quality:source-baseline` | Passed | Roadmap/source-of-truth validator accepts DB-NEON-01 direction. |
| `pnpm run quality:dashboard-route-authorization` | Passed | Existing dashboard authorization validator still passes. |
| `pnpm run quality:dashboard-route-parity` | Passed | Existing dashboard route parity validator still passes. |
| `pnpm run typecheck` | Passed | TypeScript passed after removing client-component Prisma type imports. |
| `pnpm run lint` | Passed | ESLint returned 0 errors; warnings are pre-existing style/noise. |
| `pnpm run build` | Passed | Production build completed with Prisma generate, Turbopack compile, TypeScript, and static generation. |
| `git diff --check` | Passed | No whitespace errors; Git reported Windows line-ending notices only. |

## Migration Status

`pnpm exec prisma migrate status` is read-only and is allowed in this phase. Pending migrations must not be applied by DB-NEON-01.

Pending migrations observed:

- `20260703000200_notification_delivery_attempt`
- `20260703000300_sms_delivery_guest_customer`
- `20260708000100_custom_domain_onboarding`
- `20260715000100_tenant_provisioning_readiness`

No production migration was applied during DB-NEON-01.

## Security Confirmation

- No database URL value may be printed.
- No database credential may be committed.
- `.env` may be read and updated locally, but must remain ignored.
- `.env.example` contains empty placeholders only.

## DB-NEON-02 Production Migration Acceptance Audit

Date: 2026-07-15

DB-NEON-02 production migration deployment was completed against the confirmed production Neon database using Node 20.12.2 and Prisma 6.19.3. The deploy applied six migrations:

1. `20260703000100_add_creative_studio_asset_rolled_back`
2. `20260703000200_notification_delivery_attempt`
3. `20260703000300_sms_delivery_guest_customer`
4. `20260708000100_custom_domain_onboarding`
5. `20260715000100_tenant_provisioning_readiness`
6. `20260715000200_custom_domain_status_backfill`

The sixth migration was introduced by commit `a6710fc` after clone rehearsal showed that PostgreSQL requires newly added enum values to commit before they are used in data updates. It backfills legacy `OrganizationDomain.status` values from `PENDING` to `REQUESTED` and from `FAILED` to `ERROR`. Production verification found 4 domain rows total and 0 remaining legacy `PENDING`/`FAILED` rows after deployment; in this production dataset the backfill changed 0 rows.

The original failed Creative Studio migration record remains marked rolled back, and a later successful record now exists for the same migration name. Read-only production verification confirmed no unfinished failed migrations remain, all six successful records are present, and successful migration checksums match the current source files.

Post-deploy checks passed for:

- `pnpm exec prisma migrate status --schema=prisma/schema.prisma`
- `pnpm run db:neon:check`
- `pnpm run quality:neon-serverless-runtime`
- `pnpm run test:neon-serverless-runtime`
- affected B2B, notification, SMS, dashboard route, and source-baseline validators
- `pnpm run typecheck`
- `pnpm run lint` with 0 errors and 2213 warnings
- `pnpm run build`
- `git diff --check`

`pnpm run quality:local` was run and failed with 24 existing non-DB validation issues. Visible failures included Creative Studio reviewed asset apply, public experience `PublicImage`, and AI media seller state UX checks. These failures are not caused by DB-NEON-02, but they prevent claiming the global quality suite is green.

Deployed HTTP smoke against `https://www.bazar-baz.ir` passed for public homepage, `/fa`, `/api/health`, `/fa/request-demo`, protected dashboard APIs, and unauthenticated dashboard admin pages redirecting to login. No raw Prisma error, missing-schema error, or credential-like text was exposed.

Vercel deployment metadata showed the latest production deployments for `a6710fc` and `7d21dcad` were in `ERROR` state, while the current READY production deployment was still commit `f392ee3`. Therefore the database is migrated, but the production application source was not confirmed synchronized to `a6710fc` during this audit.
