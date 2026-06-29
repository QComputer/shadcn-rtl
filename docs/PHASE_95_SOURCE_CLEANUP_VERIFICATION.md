# Phase 95 - Source Cleanup and Current-State Verification

Status: Implemented.

## Goal

Make the repository baseline trusted before PWA, Web Push, and SMS work continues.

## Source Inspection Summary

- Confirmed this project uses root `app/`, `lib/`, `components/`, and `hooks/`; there is no active `src/` tree.
- Inspected `package.json`, `pnpm-lock.yaml`, Prisma schema/migrations, app routes, service layers, components, hooks, quality/e2e scripts, docs, `README.md`, `.env.example`, and `public/`.
- Confirmed P82 deployed import/export smoke tooling exists and later AI media source/docs are present through P94.
- Confirmed the active seed script is `prisma/seed.ts`; it remains tracked because `package.json` and existing quality gates reference it.

## Cleanup Applied

- Removed tracked local artifacts:
  - `prisma/dev.db`
  - `public/myResume.pdf`
- Removed the public footer link to the personal PDF artifact.
- Removed unused duplicate client provider wrapper `components/providers.tsx`; the active provider tree remains in `app/[locale]/layout.tsx`.
- Cleaned `.gitignore` so `prisma/seed.ts` is not treated as a disposable local artifact.
- Updated `.env.example` with placeholder-only PWA, Web Push, and SMS variables.
- Updated env validation to accept both current lowercase provider values and the new uppercase dry-run aliases.
- Added `quality:source-baseline` and wired it into `quality:local`.

## Security Verification

- No real sms.ir key is retained in `.env.example`.
- The previously exposed sms.ir key must be treated as compromised and rotated before any production SMS rollout.
- Real keys must live only in local `.env` files and hosting/Vercel environment variables.
- `.env` files remain ignored and are not tracked.
- The source-baseline validator checks for committed values in common SMS, AI media, Vercel, and Render secret env assignments without printing secret contents.

## Existing Guardrails Reconfirmed

- Dashboard route/access coverage remains enforced through existing route parity, route authorization, and route guard smoke validators.
- GET purity remains enforced through `quality:get-purity`.
- Tenant identity guardrails remain enforced through `quality:tenant-identity`.
- Release artifact hygiene remains enforced through clean-source tooling and release artifact validation.

## Validation

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm run quality:source-baseline
pnpm run quality:local
```

## Next

P96 should audit and safely complete open workflow fields before PWA and notification service implementation.
