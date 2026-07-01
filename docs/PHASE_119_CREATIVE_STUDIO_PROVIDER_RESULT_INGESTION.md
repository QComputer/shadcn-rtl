# P119 - Creative Studio Provider Result Ingestion

Status: implemented

## Goal

P119 ingests organization-brand provider results into Creative Studio as draft/review-only assets, stabilizes dashboard review, and keeps public organization images unchanged until an authorized manual apply action is explicitly confirmed.

## Implemented

- Added a narrow server-side provider result contract for organization-brand outputs.
- Added centralized provider output URL validation for public http(s) images.
- Added server-only AI Media Service result polling through `getOrganizationBrandGenerationResult()`.
- Added dry-run result support that is safe when the external AI Media Service is unavailable.
- Added idempotent `ingestOrganizationBrandProviderResult()` service handling for LOGO and COVER outputs.
- Added a trusted internal ingestion route at `/api/internal/creative-studio/provider-results/organization-brand`.
- Added a dashboard refresh/check route at `/api/dashboard/creative-studio/jobs/[jobId]/refresh-provider-result`.
- Added a reject/archive route at `/api/dashboard/creative-studio/assets/[assetId]/reject`.
- Updated the Creative Studio dashboard with provider status, refresh/check controls, review-only badges, public auto-apply warnings, and reject/archive actions.
- Extended deployed Creative Studio smoke coverage for refresh/reject and secret-gated internal ingestion.
- Added `quality:creative-studio-provider-result-ingestion`.

## Safety Boundaries

- Public auto-apply remains disabled.
- `Organization.logo` and `Organization.coverImage` are not mutated by provider result ingestion.
- `Product.image`, fanpage images, and campaign assets are not mutated by provider result ingestion.
- Generated provider outputs stay draft/review-only until a separate explicit manual apply flow is used.
- Internal result ingestion requires a server-side secret.
- Browser/client components never receive provider secrets.
- The main Bazar Baz app only talks to the AI Media Service control-plane endpoint and never calls ComfyUI, GPU workers, private local workers, or `file://` outputs directly.
- Provider output URLs reject `file://`, localhost, private IP ranges, link-local IPs, credentials, protocol-relative URLs, and non-image MIME types.

## Validation

```bash
pnpm run db:generate
pnpm run db:validate
pnpm run quality:creative-studio-organization-brand-provider-rollout
pnpm run quality:creative-studio-organization-brand-provider-execution
pnpm run quality:creative-studio-provider-result-ingestion
pnpm run quality:local
pnpm run quality:source-baseline
pnpm run typecheck
pnpm run build
git diff --check
pnpm run e2e:deployed:creative-studio
```

## Next

P120 - Creative Studio reviewed asset apply and rollback workflow
