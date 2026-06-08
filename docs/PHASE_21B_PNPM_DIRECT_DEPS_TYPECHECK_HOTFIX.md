# Phase 21B — pnpm Direct Dependencies and Typecheck Hotfix

## Goal

Phase 21B fixes the target-machine typecheck blockers discovered after switching the project from the broken local npm install flow to pnpm.

## Changes

- `package.json`
  - Added direct dependencies required by source imports:
    - `zod`
    - `@fullcalendar/core`
    - `@radix-ui/react-slot`
  - Added `packageManager: pnpm@10.15.0`.
- `lib/services/order.service.ts`
  - Annotated `availableDriverStatuses` as `OrderStatus[]` to avoid TypeScript narrowing the array to only four literal enum members.

## Why this was needed

`pnpm` correctly isolates dependencies and does not expose undeclared transitive packages as top-level imports. The source imports `zod`, `@fullcalendar/core/locales/*`, and `@radix-ui/react-slot` directly, so they must be direct dependencies.

## Minimum validation

After applying this overlay, run:

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run quality:local
```

`db:generate` already passed before this hotfix, but `build` also runs Prisma generate.
