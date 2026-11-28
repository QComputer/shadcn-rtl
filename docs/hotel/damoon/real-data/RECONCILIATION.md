# Damoon Real Data Reconciliation (DAMOON-REAL-DATA-01)

Source package: Damoon-Manager-Answers-Staging-2026-11-28 (staging only, not production).

- 31 unique physical unit codes verified.
- 8 tariff categories in IRR (exact amounts preserved, sale disabled).
- 129 unresolved (null) fields preserved as null; never promoted to zero/false.
- All sale_enabled/publication_allowed false.

Reconciliation script: scripts/hotel/reconcile-damoon-real-data.mjs

Status: STAGING_REVIEW. No production import, no feature activation.
