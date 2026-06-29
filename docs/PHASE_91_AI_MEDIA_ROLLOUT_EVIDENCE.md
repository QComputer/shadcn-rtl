# Phase 91 - AI Media Rollout Evidence Archive

Status: implemented.

P91 adds operator-safe evidence retention for the deployed AI media rollout gate and keeps paid-provider enablement explicit and blocked by process.

## Implemented

- `scripts/e2e/deployed-ai-media-smoke.mjs` now writes sanitized evidence to `test-results/deployed-ai-media-rollout/evidence.json`.
- Evidence includes deployment URL, canonical URL, commit, check results, pass/fail summary, direct Render check status, optional selection-probe status, and `paidGenerationEnabled: false`.
- Evidence redacts the deployed password, AI service internal key, database URL-like values, and Blob token-like values.
- Added `scripts/release/archive-ai-media-rollout-evidence.mjs` to copy rollout evidence into `.release/ai-media-rollout-evidence/<timestamp>`.
- The archive writes `manifest.json`, copied `evidence.json`, and `REVIEW.md` with an operator checklist.
- Added `quality:ai-media-rollout-evidence` and wired the P91 validator into `quality:local`.

## Commands

Capture evidence:

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"
$env:DEPLOYED_USERNAME="Amir"
$env:DEPLOYED_PASSWORD="<password>"
pnpm run e2e:deployed:ai-media
```

Archive evidence:

```powershell
pnpm run release:ai-media-rollout-evidence
```

Optional overrides:

```powershell
$env:DEPLOYED_AI_MEDIA_EVIDENCE_DIR="test-results/deployed-ai-media-rollout"
$env:AI_MEDIA_ROLLOUT_EVIDENCE_FILE="test-results/deployed-ai-media-rollout/evidence.json"
$env:AI_MEDIA_ROLLOUT_EVIDENCE_OUT=".release/ai-media-rollout-evidence/manual-review"
```

## Paid-Provider Rule

Real paid image generation remains disabled. A later phase must add explicit controls before any paid provider rollout:

- production operator approval,
- quota/cost limits,
- Persian seller-facing status copy,
- failure/rollback procedure,
- evidence archive for the rollout decision.

## Validation

```powershell
pnpm run quality:ai-media-rollout-evidence
pnpm run e2e:deployed:ai-media
pnpm run release:ai-media-rollout-evidence
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
