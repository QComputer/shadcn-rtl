# Damoon Real Data Reconciliation (DAMOON-REAL-DATA-01)

Source package: Damoon-Manager-Answers-Staging-2026-11-28 (staging only, not production).

- 31 unique physical unit codes verified.
- 8 tariff categories in IRR (exact amounts preserved, sale disabled).
- 129 unresolved (null) fields preserved as null; never promoted to zero/false.
- All sale_enabled/publication_allowed false.

Reconciliation script: scripts/hotel/reconcile-damoon-real-data.mjs

Status: STAGING_REVIEW. No production import, no feature activation.


Owner clarification: the management source supersedes historical assumed classifications. `DRAFT-*` IDs are hypothetical and are not mapped to physical units. The local staging apply stores exact source and proposals, preserving unresolved values. Physical room updates require reviewed exact-code/ID, timestamp and `externalDependenciesAbsent` attestations; reservation, maintenance and room-type media links block updates. Unmatched codes and hypothetical drafts remain proposals. Optional attestations use a JSON array of `{ "sourceCode", "roomId", "updatedAt", "externalDependenciesAbsent": true }` entries supplied through `DAMOON_PHYSICAL_VERIFICATIONS_PATH`. Both CLI modes require the verified disposable database guard.
