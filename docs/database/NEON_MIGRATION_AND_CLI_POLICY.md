# Neon Migration And CLI Policy

Date: 2026-07-15

## Canonical CLI Path

Prisma CLI commands use `DIRECT_URL` through `prisma.config.ts`.

The Prisma schema also declares:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## Authorized In DB-NEON-01

- `pnpm run db:generate`
- `pnpm run db:validate`
- `pnpm run db:neon:check`
- `pnpm exec prisma migrate status`
- read-only `SELECT 1`
- safe `_prisma_migrations` metadata reads

## Not Authorized In DB-NEON-01

- `prisma migrate deploy`
- `prisma migrate dev`
- `prisma migrate reset`
- `prisma db push`
- seed execution
- tenant provisioning execution
- manual edits to `_prisma_migrations`
- destructive SQL

## Pending Migration Policy

Pending migrations must be reported but not applied. P11 custom-domain onboarding and P13 tenant-provisioning migrations may remain pending until a separate authorized production migration phase.

Recommended next database phase:

```txt
DB-NEON-02 - Authorized Pending Production Migration Deployment
```

## DB-NEON-02 Production Result

Date: 2026-07-15

DB-NEON-02 applied the pending production migration set with Node 20.12.2 and direct `DIRECT_URL` through `prisma.config.ts`. Node 20 remains required for Prisma migration-status and migration-deploy operations in this project; restore the normal Node 24 shell after migration work.

The production deploy applied:

- `20260703000100_add_creative_studio_asset_rolled_back`
- `20260703000200_notification_delivery_attempt`
- `20260703000300_sms_delivery_guest_customer`
- `20260708000100_custom_domain_onboarding`
- `20260715000100_tenant_provisioning_readiness`
- `20260715000200_custom_domain_status_backfill`

Operational notes:

- The original unfinished failed `20260703000100_add_creative_studio_asset_rolled_back` record had first been resolved as rolled back under explicit recovery authorization.
- Clone rehearsal found and source-fixed PostgreSQL enum migration hazards before production deploy.
- The first production `migrate deploy` attempt exited with Prisma's generic schema-engine error before opening a new migration record or applying SQL.
- A read-only `migrate status` immediately after that failure showed five pending migrations and no failed state; the subsequent deploy attempt succeeded.
- The retry and sixth backfill migration were not separately named in the final short-form authorization. Future migration approvals should name the exact migration list and explicitly allow or deny retry behavior.
- No seed, manual SQL, `db push`, `migrate dev`, `migrate reset`, tenant provisioning execution, external provider action, SMS, email, Web Push, or payment action was authorized or executed.

Post-deploy policy:

- Do not run additional production migration commands without a fresh preflight and explicit authorization.
- P11 provider/domain activation remains a separate provider mutation phase.
- P13 tenant provisioning readiness is schema-enabled, but P14 execution remains separate and must be explicitly authorized.
