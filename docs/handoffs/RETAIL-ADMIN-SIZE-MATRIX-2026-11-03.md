# Retail admin matrix and hero review

Implementation is ready for interactive browser acceptance. It is not published.

## Changes

- Product editing defaults to a bounded color-by-size inventory and price table. Full variant fields and gallery overrides remain available through details.
- New products can generate draft variants before their first save. Existing products require saved edits before server-side generation and reload persisted records after generation.
- Persian and Arabic numeric input is normalized separately from localized display. Lists accept Persian commas, ordinary commas, semicolons and newlines. Half sizes, repeated combinations and the 100-variant cap are checked.
- Generation previews are invalidated when inputs or editor state change. Stable saved-state snapshots avoid false dirty states caused by numeric base-price types or option key ordering.
- The generation route strips action metadata before strict validation and returns 400 for invalid settings.
- Hero Studio can preview the active published revision separately from the saved draft and warns before losing unsaved edits.

## Verified

- TypeScript, scoped ESLint and diff checks passed.
- Focused unit run: 30 passed, zero failed. Includes the actual generation route with mocked merchant context, matrix rendering, input parsing, snapshots, generation and hero contracts.
- Hero PostgreSQL integration: passed against disposable PostgreSQL 17 on 127.0.0.1:55439, database retail_hero_test. Covers save/reopen, publication, rollback, media revocation and tenant boundaries.
- Local loopback HTTP acceptance using real catalog services and PostgreSQL passed: four new draft combinations saved/reopened, inventory and price override persisted, four half-size combinations generated, repeat preview adds zero. This harness uses a fixed synthetic tenant; it does not replace authenticated browser acceptance.

## Remaining acceptance and release

The Browser tool repeatedly timed out while claiming the user-provided Chrome tab and while opening the local editor. No interactive browser PASS or production release is claimed.

1. Restore Browser connection and inspect the actual editor at http://127.0.0.1:4324/edit and /new. The external local harness serves the current components with real database-backed catalog APIs; Next navigation and image adapters are fixture-only.
2. Check table overflow, Persian input, details, dirty guard, save/reopen, stale-preview invalidation and post-generation reload. Check Hero Studio saved versus published preview at desktop/mobile sizes.
3. After browser acceptance, publish the exact reviewed SHA to RunFlare project 37622, service 87432, updating RUNFLARE_SOURCE_COMMIT_SHA first. Auto-pull is off. Recheck active version and all four public health endpoints.

External artifacts are under C:/Users/disso/.codex/visualizations/2026/11/01/01a19977-71e0-73f2-b983-744db19a5bb0/hero-release. Local fixture server listens on 127.0.0.1:4324; disposable container is bazarbaaz-admin-20261103. Stop both after acceptance. No production product, hero, database or provider setting was changed in this slice.

Preserve inherited migration SQL changes and untracked migration/audit artifacts. They are unrelated to this slice.
