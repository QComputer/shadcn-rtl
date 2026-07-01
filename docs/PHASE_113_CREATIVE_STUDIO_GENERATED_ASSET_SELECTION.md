# P113 - Creative Studio Generated-Asset Selection Polish and Deployed Acceptance

Status: implemented

## Goal

Polish the generated product-image review workflow after P112 by adding an explicit selected-candidate step and deployed acceptance coverage, while keeping public mutation behind the existing confirmation-gated apply controls.

## Scope

- Adds a dashboard-scoped Creative Studio asset selection endpoint.
- Records `ASSET_SELECTED` usage events and audit logs.
- Keeps selection internal and non-mutating with `publicMutation: false`.
- Ensures only one generated candidate per job is marked `SELECTED` at a time.
- Adds Persian-first dashboard copy and visual selection polish for generated asset review.
- Adds deployed Creative Studio acceptance smoke coverage for auth boundaries, secret-safe readiness, job/usage reads, and safe select rejection.

## Non-goals

- No automatic public image mutation.
- No bulk apply.
- No organization logo or cover generation.
- No campaign, fanpage, import-media, or OG-image generation expansion.
- No new provider or browser-worker calls.
- No paid-provider policy expansion.

## Validation

- `pnpm run quality:creative-studio-generated-asset-selection`
- `pnpm run e2e:deployed:creative-studio`
- `pnpm run quality:local`
- `pnpm run typecheck`
- `pnpm run build`

## Recommended next phase

P114 - Creative Studio organization-brand generation planning and readiness gate
