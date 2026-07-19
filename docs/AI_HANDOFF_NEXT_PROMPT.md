# AI Handoff - Next Prompt

## Recommended Next Prompt

```text
PHASE: BAZAR-BAZ-AI-MEDIA-PRODUCT-SERVICE-ATTACHMENT-01

Repository:
C:\Users\disso\Project\shadcn-rtl

Prerequisite:
Accept `BAZAR-BAZ-DATABASE-SCHEMA-DRIFT-NORMALIZATION-01` only after
`pnpm run test:db:schema-drift`, `pnpm run quality:db:schema-drift`,
`pnpm run test:db:migration-chain`, `pnpm run quality:db:migration-chain`,
typecheck, lint, build, source baseline, and AI-media regressions pass.
Preview env verification tooling remains required before any hosted Preview
write path: `pnpm run test:ai-media:preview-env-verification` and
`pnpm run quality:ai-media-preview-env-verification`.

Mission:
Attach imported AI media assets to products and services through the existing
application-owned asset boundary.

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
- Do not modify `bazar-baz-ai-media-service` until product/service attachment
  requirements identify an exact service result-evidence gap.

Expected work:
1. Use `validateAiMediaAssetForSelection` as the canonical imported asset
   selection boundary.
2. Add product/service attachment services and route handlers with organization
   ownership checks.
3. Preserve existing product/service image behavior and cache invalidation.
4. Add localized dashboard UI affordances for selecting imported AI assets.
5. Add unit tests, source validators, and local-only E2E where practical.
6. Update handoff and roadmap docs.

Next service-repository phase, only after attachment requirements are clear:
SERVICE-AI-RESULT-EVIDENCE-CONTRACT-01 in
C:\Users\disso\Project\bazar-baz-ai-media-service
```

## Current Database Caveat

Production migration execution is still separate. The normalization phase proves
local migration/schema parity only; it does not authorize or run Production
`prisma migrate deploy`.
