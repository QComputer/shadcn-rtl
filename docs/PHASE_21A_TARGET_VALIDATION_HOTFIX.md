# Phase 21A — Target Validation Hotfix

Date: 2026-06-08

## Goal

Phase 21A fixes the two target-machine validation blockers reported after Phase 21:

1. `npm run lint` failed because `eslint.config.mjs` imports Next.js flat config paths, but the installed package was `eslint-config-next@0.2.4`.
2. `npm run build` failed because `app/[locale]/shop/[slug]/layout.tsx` is a Server Component and used `next/dynamic(..., { ssr: false })` directly.

## Implemented changes

### ESLint package alignment

- `package.json`
  - Changed `eslint` from `^10.0.0` to `^9.39.4`.
  - Changed `eslint-config-next` from `^0.2.4` to `^16.1.6`.
  - Preserved/added `quality:release-artifact` from Phase 21.
- `package-lock.json`
  - Regenerated package-lock metadata with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund eslint@9.39.4 eslint-config-next@16.1.6`.

### Server/client boundary fix for shop map dialog

- Added `components/shop/shop-location-dialog.tsx` as a Client Component.
- Moved the `next/dynamic(..., { ssr: false })` Leaflet map import into that Client Component.
- Updated `app/[locale]/shop/[slug]/layout.tsx` so the Server Component imports and renders `ShopLocationDialog` instead of declaring the no-SSR dynamic import directly.

## Validation status

Confirmed from target-machine report before this hotfix:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
```

were already green before Phase 21A except for lint/build blockers.

Validation that must be rerun after applying this overlay:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run build
npm run quality:local
```

## Notes

If `npm run lint` now executes and reports real source lint errors, treat those as the next hotfix scope. The previous failure happened before ESLint could actually lint the source tree.
