# Phase 62A — Dashboard Organizations `searchParams` TypeScript Hotfix

This hotfix keeps the Phase 62 `/[locale]/dashboard/organizations` page behavior unchanged and fixes a narrow TypeScript issue introduced by Promise/default inference.

## Problem

`searchParams` was resolved through `Promise.all` with a fallback `{}`. TypeScript inferred the fallback as `{}`, so reads like `resolvedSearchParams.q`, `resolvedSearchParams.type`, `resolvedSearchParams.status`, and `resolvedSearchParams.page` failed during `pnpm typecheck` / `pnpm build`.

## Fix

The page now resolves params separately and explicitly types the resolved query object:

```ts
const { locale: rawLocale } = await params;
const resolvedSearchParams: SearchParams = searchParams ? await searchParams : {};
```

## Validation

Run:

```powershell
pnpm run quality:dashboard-organizations-published
pnpm typecheck
pnpm build
```
