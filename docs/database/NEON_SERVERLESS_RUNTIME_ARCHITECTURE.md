# Neon Serverless Runtime Architecture

Date: 2026-07-15

DB-NEON-01 makes Neon Serverless the canonical runtime database path for Bazar Baz.

## Canonical Path

Application runtime:

```txt
Next.js server code
-> lib/db.ts
-> lib/db-runtime.ts
-> Prisma Client
-> @prisma/adapter-neon
-> @neondatabase/serverless
-> pooled Neon DATABASE_URL
```

Prisma CLI and migrations:

```txt
Prisma CLI
-> prisma.config.ts
-> DIRECT_URL
-> direct Neon PostgreSQL connection
```

## Source Boundaries

- `lib/db.ts` is the server-only application import boundary.
- `lib/db-runtime.ts` owns the PrismaNeon adapter, Prisma Client construction, development singleton, and soft-delete helper export.
- Application runtime code must import `@/lib/db`.
- Approved local ops scripts may import `lib/db-runtime.ts` for read-only checks or explicit maintenance.
- Client components must not import `@/lib/db`, `@/lib/db-runtime`, or `@prisma/client`.
- `proxy.ts` must not import Prisma; it keeps using internal fetch-based domain resolver routes.

## Serverless Policy

- Runtime uses the pooled Neon URL from `DATABASE_URL`.
- Prisma CLI uses the direct Neon URL from `DIRECT_URL`.
- `DATABASE_URL_UNPOOLED` is retained only as a legacy compatibility alias for older ops scripts.
- The application does not create a Prisma client per request.
- The app does not call `$disconnect()` after each serverless request.
- The app does not run migrations, seeds, provider mutations, SMS sends, or tenant provisioning during startup or build.

## Health

- Basic liveness remains cheap.
- Deep health uses a redacted read-only `SELECT 1` query through the canonical Prisma client.
- Health responses must not expose hostnames, usernames, database names, URLs, raw Prisma errors, or stack traces.
