# Phase 107 - Creative Studio integration planning for main Bazar Baz

Status: implemented.

Date: 2026-06-30

## Goal

Define the Creative Studio integration plan before adding dashboard UI, public features, schema changes, or new generation endpoints.

P107 is intentionally planning-only. It converts the post-P106 baseline into an implementation contract for a future Creative Studio phase, while preserving the existing server-only AI media boundary, Persian-first product direction, tenant access rules, cost guardrails, auditability, and clean-source packaging discipline.

## Non-goals

P107 does not add:

- Creative Studio dashboard routes.
- Creative Studio API routes.
- Prisma models or migrations.
- New AI provider calls.
- New public storefront behavior.
- New seller-facing generation UI.
- New upload, Blob, Web Push, or SMS runtime behavior.

Any of those changes belong to P108 or later, after the P107 contract is accepted.

## Existing source to reuse

Creative Studio must build on the source that already exists:

- Server-only AI media client: `lib/services/ai-media-service-client.ts`
- Product-scoped AI media service: `lib/services/ai-media.service.ts`
- Paid-provider gate: `lib/services/ai-media-paid-provider.ts`
- Runtime environment policy: `lib/runtime-env.ts`
- Product AI endpoints: `app/api/dashboard/products/[productId]/ai-image-suggestions/route.ts`
- AI media status endpoint: `app/api/dashboard/ai-media/status/route.ts`
- AI media usage endpoint: `app/api/dashboard/ai-media/usage/route.ts`
- Product edit AI state UX: `components/dashboard/ai-media-provider-state.tsx`
- Import-to-AI-media prompt bridge: `lib/services/import-hub.service.ts`
- Durable image copy helper: `lib/media-storage.ts`
- P106 acceptance and packaging gate: `docs/PHASE_106_PWA_PUSH_SMS_ACCEPTANCE_GATE.md`

Creative Studio must not call local workers directly. Bazar Baz continues to call only the configured server-side AI media service through authenticated Bazar Baz APIs.

## Product definition

Creative Studio is the future seller/operator workspace for generating, reviewing, adapting, and applying business creative assets.

Initial Creative Studio surfaces should stay inside the dashboard and should support these asset families in separate follow-up phases:

1. Product image variants and listing visuals.
2. Offer or campaign images for Customer Club campaigns.
3. Fanpage post images or captions.
4. Tenant brand assets such as logo, cover, and Open Graph fallback direction.
5. Import Hub creative cleanup for seller-approved imported media.

The first implementation phase after P107 should start narrow. The recommended P108 scope is Creative Studio server foundation for asset jobs, audit rows, and read-only status APIs before any broad UI.

## Server boundary

All Creative Studio work must pass through a Bazar Baz service layer.

Required boundary rules:

- Use authenticated dashboard API routes only.
- Resolve the current organization before every read/write.
- Require `product:update`, campaign management, fanpage management, or organization settings permissions depending on the target asset.
- Store local job ownership and status before calling an external service.
- Never expose provider secrets, internal keys, raw provider payloads, or signed private URLs to clients.
- Keep provider calls behind server-only modules.
- Keep paid providers disabled unless the existing paid-provider approval, budget, and rollback gates are green.
- Reuse `AiMediaUsageEvent`-style audit and cost metadata or define an equivalent Creative Studio event model in P108.
- Revalidate public shop, appointment, fanpage, product, and home caches only after an asset is explicitly selected or applied.

## Consent and asset policy

Creative Studio must be seller-initiated and review-gated.

Consent rules:

- Imported or external media can be used only when the seller provided or approved the source.
- Creative Studio must keep source URL, source type, and prompt/source metadata for generated or adapted assets.
- Generated assets remain drafts until a user applies them.
- Applying generated assets to logo, cover, product, fanpage, or campaign surfaces requires an explicit action.
- No automatic replacement of public images.
- No scraping, crawling, or private-source fetching.
- No use of customer personal data in prompts.

## Access rules

Planned access model:

| Target | Minimum role or permission |
| --- | --- |
| Product image variants | Organization role with `product:update` |
| Campaign creatives | ADMIN or MANAGER with campaign access |
| Fanpage creatives | ADMIN or MANAGER with fanpage/post access |
| Organization logo/cover | ADMIN or MANAGER with organization settings access |
| Platform templates and provider rollout | SUPER_ADMIN only |

All reads and writes must stay organization-scoped. SUPER_ADMIN access must not bypass organization selection for tenant-owned assets.

## Planned data model

P108 should add a minimal Creative Studio server foundation only if the implementation cannot safely reuse `AiMediaJob`.

Candidate model shape:

- `CreativeStudioJob`: organization, actor, target type, target id, prompt metadata, provider, status, cost estimate, error code, created/applied timestamps.
- `CreativeStudioAsset`: organization, job, asset type, draft URL, stored Blob URL, source metadata, dimensions, MIME type, selected/applied status.
- `CreativeStudioUsageEvent`: organization, actor, action, provider, cost estimate, quota metadata, rollback metadata.

The model must support draft review, audit, quota enforcement, cancellation, and later evidence export.

## Planned API surface

P108 should prefer a small server-first API set:

- `GET /api/dashboard/creative-studio/status`
- `GET /api/dashboard/creative-studio/usage`
- `GET /api/dashboard/creative-studio/jobs`
- `POST /api/dashboard/creative-studio/jobs`
- `GET /api/dashboard/creative-studio/jobs/[jobId]`
- `POST /api/dashboard/creative-studio/jobs/[jobId]/cancel`
- `POST /api/dashboard/creative-studio/assets/[assetId]/apply`

Every route must use existing session guards, organization membership checks, target ownership checks, schema validation, and safe error responses.

## Planned dashboard UX

P108 should not start with a broad canvas. The first UI should be a narrow dashboard tool once the server foundation exists.

UX requirements:

- Persian (`fa`) copy is the primary copy and must be present first.
- English and Arabic dictionary parity must be added with the feature.
- Show provider state, quota, budget, rollback pause, and draft/apply state before starting generation.
- Make cancel/retry/resume states explicit for long-running jobs.
- Use current dashboard visual density and patterns, not a marketing-style landing page.
- Never hide paid-provider state behind decorative copy.

## Rollout gates

Before any Creative Studio UI ships, P108 must define and pass:

- `quality:creative-studio-foundation`
- `quality:creative-studio-access`
- `quality:creative-studio-cost-guardrails`
- `quality:creative-studio-i18n`
- `quality:creative-studio-cache-revalidation`
- optional deployed smoke for MOCK provider only

Paid-provider rollout remains blocked until the same style of explicit approval, cost, rollback, and evidence gates used by P92-P94 exists for Creative Studio.

## P107 validation

P107 is validated by:

```powershell
pnpm run quality:creative-studio-planning
pnpm run quality:ai-media
pnpm run quality:ai-media-paid-provider-controls
pnpm run quality:ai-media-cost-rollback
pnpm run quality:pwa-push-sms-acceptance
pnpm run quality:clean-source
pnpm run quality:local
pnpm run typecheck
```

## Known limitations

- P107 is not a product feature release.
- P107 intentionally leaves schema and UI implementation for P108.
- The existing product AI media flow remains product-image-specific until Creative Studio server foundations are built.
- Real paid generation remains disabled unless explicitly enabled by the existing guardrails and future Creative Studio-specific gates.

## Recommended next phase

P108 - Creative Studio server foundation.
