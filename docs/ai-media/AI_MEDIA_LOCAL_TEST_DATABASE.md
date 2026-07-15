# AI Media Local Test Database

Date: 2026-07-15

The hermetic suite uses a disposable local PostgreSQL database named `bazar_baz_ai_media_acceptance`.

## Requirements

- Localhost only.
- No Production Neon credentials.
- No Production data or dump.
- Source migrations only.
- Synthetic fixtures only.

## Runtime

The deployed application runtime remains Neon Serverless through `PrismaNeon`. For hermetic acceptance only, `lib/db-runtime.ts` permits a plain local Prisma client when all of these are true:

- `NODE_ENV=test`
- `AI_MEDIA_APPLICATION_STORAGE_ADAPTER=local-test`
- `DATABASE_URL` points to `localhost` or `127.0.0.1`
- the database URL does not resemble Neon

This test-only path exists so the app services can be exercised against local PostgreSQL without contacting Production Neon.
