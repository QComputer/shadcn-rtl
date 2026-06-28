# Phase 84 - AI Media Health Gate Audit

Status: implemented.

P84 audits and hardens the existing server-only AI media integration against the deployed Render service contract. It does not add paid image generation and does not introduce any local worker dependency in Bazar Baz.

## Implemented

- Added a server-only AI media config status helper that reports readiness through booleans only.
- Added an optional Render readiness probe for `/health` and `/ready`.
- Kept the dashboard status response secret-safe; it never returns the internal key or remote response bodies.
- Protected the dashboard AI media status route with the existing session guard.
- Preserved the legacy `enabled` boolean for dashboard UI compatibility, now tied to full local readiness.
- Normalized invalid timeout configuration back to the default timeout instead of creating instant failures.
- Ensured caller-provided fetch headers cannot override the internal AI media auth header.
- Added `quality:ai-media-health-gate` and wired it into `quality:local`.

## Runtime Contract

- Bazar Baz calls only the configured Render AI media service URL.
- `AI_MEDIA_SERVICE_INTERNAL_KEY` remains server-only.
- `/api/dashboard/ai-media/status` returns local readiness without contacting Render by default.
- `/api/dashboard/ai-media/status?check=1` explicitly checks Render `/health` and `/ready`.
- Disabled or partially configured AI media returns controlled readiness fields and keeps the product AI UI disabled.

## Validation

```powershell
pnpm run quality:ai-media-health-gate
pnpm run quality:ai-media
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
