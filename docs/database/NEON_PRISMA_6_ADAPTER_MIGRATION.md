# Neon Prisma 6 Adapter Migration

Date: 2026-07-15

## Version Policy

DB-NEON-01 keeps Prisma on major version 6.

Installed/runtime-aligned packages:

- `prisma`: 6.x, resolved as 6.19.3
- `@prisma/client`: 6.x, resolved as 6.19.3
- `@prisma/adapter-neon`: 6.19.3
- `@neondatabase/serverless`: 1.1.0
- `ws`: runtime WebSocket constructor for Neon serverless driver in Node.js

No Prisma 7 upgrade was performed.

## Implementation

The Prisma adapter code lives in `lib/db-runtime.ts`:

- reads only `process.env.DATABASE_URL`
- configures `neonConfig.webSocketConstructor`
- constructs `new PrismaNeon({ connectionString })`
- constructs `new PrismaClient({ adapter, log })`
- stores the development singleton on `globalThis`

The application import boundary is `lib/db.ts`, which is marked server-only and re-exports the runtime client and soft-delete helpers.

## Compatibility Review

Patterns retained:

- interactive `$transaction(async tx => ...)`
- array `$transaction([...])`
- raw read-only `$queryRaw`
- administrative `$executeRawUnsafe` only in explicit ops/quality scripts
- Decimal/date/JSON usage through Prisma Client

No business transaction logic was rewritten in DB-NEON-01.

## Rollback

Rollback is source-only:

1. Revert the DB-NEON-01 commit.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm run db:generate`.
4. Do not mutate production migration history as part of rollback.
