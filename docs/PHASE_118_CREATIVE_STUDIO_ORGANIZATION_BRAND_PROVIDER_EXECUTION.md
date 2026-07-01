# P118 - Creative Studio Organization Brand Provider Execution

Status: implemented

## Goal

P118 implements provider execution wiring for organization logo and cover requests behind the P117 rollout gate.

## Implemented

- Added a server-only AI Media Service organization-brand execution adapter.
- Added explicit execution and dry-run environment gates.
- Added a dashboard API route for organization brand execution requests.
- Wired Creative Studio organization-brand requests to either disabled, dry-run, or provider-requested mode.
- Stored provider request metadata and remote provider job IDs when real execution is enabled.
- Drafted returned logo/cover outputs only as Creative Studio assets; public logo/cover fields are not mutated.
- Added dashboard execution/dry-run status badges and Persian-first safety copy.
- Extended deployed Creative Studio smoke coverage for the P118 server route.
- Added `quality:creative-studio-organization-brand-provider-execution`.

## Safety Boundaries

- Execution is disabled by default.
- Dry-run is enabled by default.
- No browser-side provider calls.
- No provider secrets are exposed to client components.
- Bazar Baz calls only the AI Media Service endpoint, never a GPU worker or ComfyUI directly.
- Generated assets remain draft/review-only.
- Public auto-apply remains disabled.
- `Organization.logo` and `Organization.coverImage` are not mutated by provider execution.

## Validation

```bash
pnpm run db:generate
pnpm run db:validate
pnpm run quality:creative-studio-organization-brand-provider-rollout
pnpm run quality:creative-studio-organization-brand-provider-execution
pnpm run quality:local
pnpm run quality:source-baseline
pnpm run typecheck
pnpm run build
git diff --check
pnpm run e2e:deployed:creative-studio
```

## Next

P119 - Creative Studio provider execution smoke and generated asset ingestion
