# Phase 98 - Offline Shell, Caching, and PWA Quality Gates

Date: 2026-06-29

## Goal

Add a conservative offline shell and static-asset cache strategy without serving stale dashboard, checkout, booking, payment, or customer-state HTML.

## Implemented

- Added `public/offline.html` as a static Persian-first offline fallback page.
- Extended `public/web-push-sw.js` with a versioned P98 static cache.
- Precaches only the offline shell, manifest, and PWA icon assets.
- Adds network-first navigation handling with fallback to the offline shell when the network is unavailable.
- Adds cache-first behavior only for static assets such as `/_next/static/*`, manifest, icons, and favicon.
- Bypasses static caching for `/api/*`, `/uploads/*`, dashboard, checkout, booking, order, payment, appointment, auth, and registration paths.
- Keeps the existing Web Push `push` and `notificationclick` handlers intact.
- Adds `scripts/quality/validate-pwa-offline-shell.mjs` and wires it into `quality:local`.

## Guardrails

- Page HTML is not written to the cache, so dashboard and transactional pages cannot be replayed as stale app state.
- Upload URLs are not cached by the service worker, preserving the existing media freshness and Blob/public image behavior.
- API routes remain network-only.
- The offline shell is generic and contains no user, order, booking, or organization data.
- Notification permission remains separate from PWA install and offline behavior.

## Validation

```powershell
pnpm run quality:pwa-offline-shell
pnpm run quality:pwa-foundation
pnpm run quality:local
pnpm run typecheck
pnpm lint
pnpm run build
```

## Next

P99 should introduce the notification domain model and preferences before real Web Push delivery.
