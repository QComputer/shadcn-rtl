# Phase 83 - Project State Reconciliation and AI Media Readiness

P83 reconciles the actual repository state after P82 with the newer AI media roadmap.

## Current Repository Facts

- P82 deployed import/export smoke is complete.
- Local `main` also contains AI media updates after P82:
  - `9ee4004 fix(ai-media): resolve drift, add tests, align docs and select route`
  - `7c05681 feat(ai-media): copy selected images to durable blob storage (BZ-AI-02)`
  - `5ab3b2c docs(ai-media): document durable blob storage in select flow`
- The app uses `app/`, `lib/`, `components/`, `scripts/`, and `docs/`; there is no active `src/app` layout.
- The AI media service is deployed separately at `https://bazar-baz-ai-media-service.onrender.com`.
- Bazar Baz must call only the Render AI media service. It must not call or know about local workers directly.
- `AI_MEDIA_SERVICE_INTERNAL_KEY` remains server-only and must never use `NEXT_PUBLIC_`.
- Product AI suggestions already use a server-mediated flow through Bazar Baz APIs.
- Selected AI outputs are copied to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is configured, with remote Render URLs used only as fallback.

## Stale Documentation

`docs/AI_HANDOFF_PROJECT_CONTEXT.md` is historically useful, but its recommendation to restart at Phase 18 is stale. The current validated roadmap is P83+.

## Current AI Media Status

Implemented or partially implemented:

- Server-only AI media service client.
- Authenticated product image suggestion APIs.
- Product edit UI for AI suggestions.
- Local `AiMediaJob` ownership tracking.
- Deployed AI media service route-protection and Render health smoke coverage.
- Durable selected-image copy to Vercel Blob when configured.

Still required before real paid AI generation:

- P84 audit/hardening of the server-only client and health gate.
- P87 long-running/local-worker-compatible job state UX.
- P88 usage logs, quotas, and admin controls.
- P89 import-draft-to-AI-image workflow integration.
- P90 deployed AI media end-to-end rollout gate through Bazar Baz.

## Validation

```powershell
pnpm run typecheck
pnpm run build
pnpm run quality:local
```
