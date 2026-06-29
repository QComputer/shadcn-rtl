# Phase 94 - AI Media Seller-Facing Paid Provider State UX

Status: Implemented.

## Goal

Expose a Persian-first, seller-readable AI media state in dashboard product workflows before paid-provider launch.

## Implemented

- Added `components/dashboard/ai-media-provider-state.tsx` to derive and render seller states for disabled, MOCK, approved, budget-exhausted, rollback-paused, and loading modes.
- Wired product edit to fetch both `/api/dashboard/ai-media/status` and `/api/dashboard/ai-media/usage`, show the state panel, and disable generation when quotas, budget, or rollback state prevent new jobs.
- Wired product creation to show the same state panel with saved-product guidance, since actual AI generation is only available after the product exists.
- Kept provider policy internals, environment variable names, approval metadata, and estimated job costs out of seller-facing copy.
- Added `pnpm run quality:ai-media-seller-state-ux` and included it in `quality:local`.

## Validation

```powershell
pnpm run quality:ai-media-seller-state-ux
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Next

P95 should add an operator runbook and deployed UX smoke for the seller-facing AI media paid-provider states.
