# Phase 20A — Typecheck and Lint Hotfix

This overlay fixes the TypeScript narrowing issue introduced in Phase 20 inside `app/api/orders/[id]/route.ts`.

## Fix

The P20 route passed the full `ZodSafeParseResult` object into a helper typed to accept only failed parse results. TypeScript did not narrow the value enough at the function-call boundary, causing the production build to fail.

The hotfix now:

- checks `validation.success === false`,
- passes `validation.error` to the helper,
- keeps the same API behavior and validation messages.

## ESLint package alignment

If `npm run lint` fails with:

```txt
Cannot find module 'eslint-config-next/core-web-vitals'
```

then the installed `eslint-config-next` package is the wrong package/version. For Next.js 16, align it with the Next version used by this project:

```powershell
npm install -D eslint-config-next@16.1.6
```

Then rerun:

```powershell
npm run lint
npm run build
```
