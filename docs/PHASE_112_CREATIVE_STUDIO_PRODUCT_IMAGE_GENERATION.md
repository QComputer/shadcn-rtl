# P112 - Creative Studio Product-Image Generation Request Controls and Long-Running Job UX

Status: implemented

## Goal

P112 enables seller-facing Creative Studio controls for product-image generation while staying inside the P111 AI media service contract.

## Scope

- Enables only `PRODUCT` + `PRODUCT_IMAGE` + `product.image` generation requests.
- Reuses the existing server-only `aiMediaService` and `AI_MEDIA_SERVICE` contract.
- Stores the remote AI media job id in `CreativeStudioJob.inputs.p112Generation`.
- Syncs remote job status through Creative Studio job reads and list refreshes.
- Drafts completed remote outputs as `CreativeStudioAsset` rows for review.
- Keeps public mutation behind the existing confirmation-gated apply controls.
- Adds bounded dashboard polling, continue polling, and cancel controls.

## Non-goals

P112 does not add browser-to-worker calls, direct provider calls from the dashboard, new providers, organization-brand generation, fanpage generation, campaign generation, import-media generation, automatic public apply, or deployed rollout evidence.

## Validation

```powershell
pnpm run quality:creative-studio-product-image-generation
pnpm run quality:creative-studio-generation-readiness
pnpm run quality:creative-studio-apply-controls
pnpm run quality:creative-studio-dashboard
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Next phase

P113 - Creative Studio generated-asset selection polish and deployed acceptance
