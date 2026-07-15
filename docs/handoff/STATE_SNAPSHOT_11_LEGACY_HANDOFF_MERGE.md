# STATE-SNAPSHOT-11: Legacy Handoff Merge

Date: 2026-07-15

## Canonical Directory

`docs/handoff/` is the canonical handoff snapshot directory.

The older `docs/hand-off/` directory was inspected before removal. Its unique useful context was historical: it documented the pre-B2B gap after notification/SMS/Web Push work, the older recommendation to start public B2B repositioning, and production notes around the notification operations hardening. That information is now superseded by and represented in:

- `docs/handoff/STATE_SNAPSHOT_00_MASTER_SUMMARY.md`
- `docs/handoff/STATE_SNAPSHOT_04_B2B_POSITIONING_REPORT.md`
- `docs/handoff/STATE_SNAPSHOT_06_OPERATIONAL_SERVICES_REPORT.md`
- `docs/handoff/STATE_SNAPSHOT_08_VALIDATION_REPORT.md`
- `docs/handoff/STATE_SNAPSHOT_09_DEPLOYMENT_REPORT.md`
- `docs/handoff/STATE_SNAPSHOT_10_NEXT_ROADMAP.md`
- `docs/completion/PROJECT_COMPLETION_BASELINE.md`
- `docs/completion/MASTER_PROJECT_COMPLETION_ROADMAP.md`

## Merge Decision

The legacy reports predated BB-B2B-P00 through BB-B2B-P12 and described a marketplace-like public-surface gap that has already been addressed by the B2B roadmap. Keeping both directories caused contradictory handoff signals, especially around the recommended next phase.

The current accepted direction is:

- Product identity: Persian-first B2B service platform.
- Completed B2B source work: BB-B2B-P00 through BB-B2B-P12.
- Current recommendation: BB-B2B-P13 - Guided Tenant Provisioning Readiness.
- P11 production custom-domain activation still requires explicit authorization for migration/provider/domain mutation.

## Removed Duplicate Directory

`docs/hand-off/` was removed after this merge note because it was a duplicate legacy handoff location with stale recommendations.
