# AI Handoff - Next Prompt

## Recommended Next Prompt

```text
PHASE: BAZAR-BAZ-AI-MEDIA-ASSET-LIBRARY-LIFECYCLE-01

Repository:
C:\Users\disso\Project\shadcn-rtl

Prerequisite:
Accept `BAZAR-BAZ-AI-MEDIA-PRODUCT-SERVICE-ATTACHMENT-01` only after
`pnpm run test:ai-media:product-service-attachment`,
`pnpm run quality:ai-media-product-service-attachment`,
`pnpm run e2e:ai-media:local-docker-product-service-attachment`, typecheck,
lint, build, source baseline, Preview env verification tooling, and AI-media
regressions pass.

Mission:
Harden the Creative Studio AI media asset library lifecycle after product and
service attachment: browsing, filtering, retention/delete states, attachment
visibility, audit events, and operator-safe cleanup workflows.

Rules:
- Do not call Render directly from the browser.
- Do not expose Render or storage credentials.
- Do not accept caller-supplied storage keys.
- Keep no Blob writes in local/source validation unless a separate authorized
  storage-import phase explicitly enables an application-managed local adapter.
- Do not mutate Production DB without separate authorization.
- Do not write Production Blob/storage during source work.
- Keep Production asset consumption fail-closed unless storageKey migration and
  storage activation are explicitly authorized.
- Do not execute P07 or real generation without separate explicit
  authorization.

Expected work:
1. Inspect the accepted product/service attachment source first.
2. Preserve entity attachment semantics and manual image fallback.
3. Add lifecycle controls only through server-owned asset services.
4. Add localized dashboard UX for library state and cleanup.
5. Add unit tests, source validators, and local-only E2E where practical.
6. Update handoff and roadmap docs.

Future P07 controlled Production application-managed asset import remains
pending separate authorization and must not expose Blob credentials to Codex,
Render, GPU workers, browsers, or tests.
```

## Current Database Caveat

Production migration execution is still separate. The normalization phase proves
local migration/schema parity only; it does not authorize or run Production
`prisma migrate deploy`.
