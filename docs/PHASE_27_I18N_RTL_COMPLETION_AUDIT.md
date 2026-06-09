# Phase 27 — i18n / RTL Completion Audit

Date: 2026-06-09

## Goal

P27 adds a greenable audit gate for localization and RTL/LTR readiness without attempting a large translation rewrite in the same phase.

This phase is intentionally narrow. It does not complete every missing translation key and does not migrate all hardcoded Persian/Arabic UI text. It makes the debt visible and keeps future phases from losing track of it.

## Source changes

### Audit validator

Added `scripts/quality/validate-i18n-rtl-audit.mjs` and `pnpm run quality:i18n-rtl`.

The validator checks blocking basics:

- `dictionaries/fa.json`, `dictionaries/en.json`, and `dictionaries/ar.json` exist.
- Each dictionary parses as JSON.
- Each dictionary has at least one flattened key.
- `supportedLocales` includes `fa`, `en`, and `ar`.
- `fa` and `ar` are configured as RTL.
- `en` is configured as LTR.
- the locale layout sets both `<html lang>` and `<html dir>`.

The validator also reports non-blocking audit warnings:

- missing and extra dictionary keys compared with Persian (`fa`);
- hardcoded RTL-script characters in TypeScript/TSX UI source;
- stale brand copy such as `ShopifyX`.

### Aggregate quality gate

Updated `scripts/quality/validate-project.mjs` so `quality:local` now runs the P27 i18n/RTL audit validator.

### Metadata cleanup

Updated `app/[locale]/layout.tsx` metadata to remove stale `ShopifyX` OpenGraph text and use Bazar Baz copy.

## Current audit findings

Current P27 audit warnings are expected and non-blocking in this phase:

- English is missing dictionary keys compared with Persian.
- Arabic is missing dictionary keys compared with Persian.
- Several TS/TSX files still contain hardcoded Persian/Arabic UI strings.

These are documented completion tasks for future localization phases.

## Validation

Required target validation:

```powershell
pnpm run quality:i18n-rtl
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Recommended next phase

P28 — release artifact / secret hygiene hardening.
