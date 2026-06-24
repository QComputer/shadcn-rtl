# Phase 31 — i18n Completion Pass

Date: 2026-06-09

## Goal

Close the blocking FA/EN/AR dictionary key drift found by the P27 i18n/RTL audit, while keeping the broader hardcoded dashboard-copy cleanup as documented non-blocking debt.

## Implemented

- Completed missing English dictionary keys against the Persian base dictionary.
- Completed missing Arabic dictionary keys against the Persian base dictionary.
- Added missing Persian keys that already existed only in EN/AR.
- Brought `fa`, `en`, and `ar` to the same dictionary leaf-key count.
- Added `scripts/quality/validate-i18n-completion.mjs`.
- Added `pnpm run quality:i18n-completion`.
- Added the P31 validator into `quality:local`.

## Validation rule

P31 now blocks:

- Missing locale dictionary files.
- Invalid JSON dictionaries.
- Empty/non-string dictionary leaf values.
- Missing or extra keys between `fa`, `en`, and `ar`.
- Missing locale direction configuration.
- Missing `<html lang>` / `<html dir>` behavior.
- Stale `ShopifyX`/template branding in app/components/lib.

## Known non-blocking debt

There are still hardcoded Persian/RTL-script strings in dashboard and admin TS/TSX files. These are intentionally reported as warnings in P31 because converting all dashboard copy in one phase would be too broad and risky.

Recommended follow-up:

```txt
P32 — Dashboard Copy Extraction and RTL/LTR UI Cleanup
```

## Required target validation

```powershell
pnpm run quality:i18n-completion
pnpm run typecheck
pnpm run build
pnpm run quality:local
```
