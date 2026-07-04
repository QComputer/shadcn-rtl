# NOTIFOPS-DEPLOY-FIX1 — Notification Browser and Realtime Hardening

Date: 2026-07-04

## Summary

Production console on `https://www.bazar-baz.ir` showed:
- repeated `http://localhost:4001/socket.io/` connection errors
- generic "مرورگر شما از اعلان مرورگر پشتیبانی نمی‌کند" message on supported browsers
- `Missing Description` Radix DialogConsole warning
- `width(-1) and height(-1) of chart should be greater than 0` warning

This hotfix removes the hardcoded localhost socket fallback, tightens production realtime URL validation, improves browser push capability detection, and resolves dashboard console warnings.

## Root cause

- `context/SocketContext.tsx` had `const effectiveSocketUrl = SOCKET_SERVER_URL || "http://localhost:4001"`, which hardcoded localhost in the client bundle and caused browser console noise when `NEXT_PUBLIC_SIGNALING_SERVER_URL` was unset or stale.
- `components/dashboard/dashboard-push-opt-in.tsx` collapsed multiple capability failures into a single generic "unsupported" copy, including catch-all fallback for `permissions.query` errors.
- Dashboard dialogs and chart containers had accessibility and sizing gaps.

## Fixes

- production localhost socket call removed/gated: yes
- realtime production URL safety added: yes
- Web Push capability detection improved: yes
- Web Push/VAPID diagnostics added: yes
- DialogContent description fixed: yes
- chart zero-size warning fixed: yes
- notification operations deployed smoke added/updated: yes

## Production must never use localhost socket URLs

Socket.IO is optional in production. It is enabled only when:
- `NEXT_PUBLIC_SIGNALING_SERVER_URL` is set to a public HTTPS/WSS URL, AND
- `NODE_ENV !== production` OR the URL passes `isSafePublicRealtimeUrl` validation.

Realtime is optional and safely gated. Notification operations page uses polling and Web Push as fallbacks.

## Browser notification support is capability-detected

The dashboard push opt-in now distinguishes:
- unsupported browser (no service worker / push manager / notification API)
- insecure context / not HTTPS
- permission denied
- permission prompt available / granted / subscribed
- VAPID public key missing

Unsupported messages are specific and actionable. No SMS is sent by diagnostics.

## Verification

Run:

```powershell
pnpm run quality:realtime-production-config
pnpm run quality:web-push-capability-detection
pnpm run quality:notification-ops-deployed-safety
pnpm run quality:local
pnpm run build
```

Deployed smoke:

```powershell
pnpm run e2e:deployed:notification-operations
```
