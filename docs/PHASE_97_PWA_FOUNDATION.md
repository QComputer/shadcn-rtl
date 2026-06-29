# Phase 97 - PWA Foundation and Install Experience

Date: 2026-06-29

## Goal

Make Bazar Baz installable as a Persian-first PWA without changing first-visit locale behavior or introducing offline caching before the dedicated offline phase.

## Implemented

- Added `app/manifest.ts` with Persian-first app metadata, `/fa` start URL, standalone display mode, RTL direction, app shortcuts, and PWA icons.
- Added `public/pwa-icon.svg` and `public/pwa-maskable-icon.svg` for browser install surfaces and notification defaults.
- Added global metadata in `app/[locale]/layout.tsx` for the manifest, app icons, Apple web app mode, and phone-number format detection.
- Added `components/pwa-install-manager.tsx` to register the existing root service worker and show a localized install prompt after the browser emits `beforeinstallprompt`.
- Extended `public/web-push-sw.js` with install/activate lifecycle handlers while preserving the existing Web Push `push` and `notificationclick` behavior.
- Added `scripts/quality/validate-pwa-foundation.mjs` and `quality:pwa-foundation`.

## Guardrails

- Persian (`fa`) remains the first-visit default through `/` to `/fa` routing and the manifest `start_url`.
- The PWA install manager reuses `/web-push-sw.js` at root scope to avoid competing service workers.
- Notification permission is still requested only by the explicit Web Push opt-in flow, not by the PWA install prompt.
- P97 does not add `fetch` caching, cache priming, background sync, or offline fallbacks. Those belong to P98.
- The install manager is guarded by `PWA_ENABLED !== "false"` and only registers on HTTPS or localhost.

## Validation

```powershell
pnpm run quality:pwa-foundation
pnpm run quality:local
pnpm run typecheck
pnpm lint
pnpm run build
```

## Next

P98 should add the offline shell, cache strategy, and PWA quality gates with explicit no-stale-data rules for dashboard and transactional routes.
