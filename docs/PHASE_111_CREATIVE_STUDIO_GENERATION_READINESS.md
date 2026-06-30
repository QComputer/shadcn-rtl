# P111 - Creative Studio Generation Readiness Gate and AI-Service Contract Sync

Status: implemented

## Goal

P111 synchronizes Creative Studio with the existing Bazar Baz AI media service contract before any broader generation UI is added. It adds a server-only readiness contract, a secret-safe dashboard status summary, and validator coverage.

## Scope

- Adds `lib/services/creative-studio-generation-readiness.ts`.
- Extends `GET /api/dashboard/creative-studio/status` with `generationReadiness`.
- Keeps remote AI media `/health` and `/ready` checks opt-in through `?check=1`.
- Shows a Persian-first readiness card on `/dashboard/creative-studio`.
- Documents that the only synced upstream generation contract is product image suggestions.

## Supported contract

The only generation contract considered ready for a later implementation phase is:

- Upstream: `AI_MEDIA_SERVICE`
- Create endpoint: `/v1/product-image-suggestions/jobs`
- Status endpoint: `/v1/product-image-suggestions/jobs/{jobId}`
- Cancel endpoint: `/v1/product-image-suggestions/jobs/{jobId}/cancel`
- Supported target: `PRODUCT` + `PRODUCT_IMAGE` + `product.image`
- Required fields: `organization_id`, `product_id`, `requested_by_user_id`, `product_title`, `category`
- Optional fields: `description`, `seller_prompt`, `brand`, `input_images`, `count`, `aspect_ratio`, `style_preset`

## Explicit non-goals

P111 does not add:

- Generation forms
- Browser-to-worker calls
- Direct GPU worker calls
- New generation providers
- Paid provider enablement
- Automatic public mutation
- Campaign, fanpage, brand, OG, or import-media generation

## Readiness behavior

The readiness helper returns secret-safe booleans for service enablement, URL configuration, internal-key configuration, timeout, paid-provider rollback, and optional remote readiness checks. It never returns the internal key, provider secrets, raw remote bodies, or signed URLs.

`generationRequestEnabled` and `generationUiEnabled` remain `false`. P112 must explicitly implement product-image generation controls if the contract remains acceptable.

## Dashboard behavior

The dashboard shows:

- AI service readiness
- Server-only policy
- Browser direct-call policy
- Contract version
- Supported and unsupported targets
- Readiness blockers

It does not show a generation form or a start-generation button.

## Validation

```powershell
pnpm run quality:creative-studio-generation-readiness
pnpm run quality:creative-studio-dashboard
pnpm run quality:creative-studio-apply-controls
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Next phase

P112 - Creative Studio product-image generation request controls and long-running job UX
