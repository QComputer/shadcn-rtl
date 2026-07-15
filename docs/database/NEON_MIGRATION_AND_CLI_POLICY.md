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
