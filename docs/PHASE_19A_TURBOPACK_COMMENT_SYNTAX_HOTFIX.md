# Phase 19A — Turbopack Comment Syntax Hotfix

This overlay fixes a production build parser failure in `lib/access-control.ts` introduced by the P19 RBAC overlay.

## Root cause

A JSDoc comment contained the text `app/[locale]/dashboard/**/page.tsx`.

Inside a block comment, the `**/` sequence contains `*/`, so TypeScript/Turbopack treated the block comment as closed early. The next comment line began with `*`, which was parsed as JavaScript and caused:

```txt
Parsing ecmascript source code failed
Expression expected
```

## Fix

The comment was rewritten to avoid any `*/` sequence inside JSDoc text:

```txt
Keep this registry aligned with localized dashboard page files.
```

No runtime RBAC logic was changed.

## Validation run in the inspected tree

```bash
node scripts/quality/validate-dashboard-access.mjs
node scripts/quality/validate-project.mjs
```

Both passed. Full `npm run build` still needs to be run locally after dependencies are installed.
