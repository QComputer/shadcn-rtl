# Neon Connection Variable Policy

Date: 2026-07-15

## Variables

| Variable | Role | Required | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Application runtime | Yes | Pooled Neon connection. Should normally use the Neon pooler endpoint. |
| `DIRECT_URL` | Prisma CLI and migrations | Yes | Direct, unpooled Neon connection for migrations, introspection, and administrative schema operations. |
| `DATABASE_URL_UNPOOLED` | Legacy compatibility | Temporary | Retained for older ops scripts. Prefer `DIRECT_URL` for new work. |

## Rules

- Never print or commit URL values.
- Never expose database variables through `NEXT_PUBLIC_*`.
- Never silently fall back to local SQLite or local PostgreSQL for production runtime.
- Never use `DIRECT_URL` from Next.js runtime application code.
- Never use `DATABASE_URL` for Prisma migration deploy/status when `DIRECT_URL` is available.
- Do not remove `DATABASE_URL_UNPOOLED` until older operational scripts are migrated.

## Local Compatibility

During DB-NEON-01, local `.env` was updated securely so `DIRECT_URL` mirrors the existing direct Neon credential already stored under `DATABASE_URL_UNPOOLED`. The value was not printed, logged, documented, or committed.

## `.env.example`

Only empty placeholders are allowed:

```txt
DATABASE_URL=
DIRECT_URL=
DATABASE_URL_UNPOOLED=
```
