# Retail admin matrix and hero review

Published and verified on RunFlare v13, source SHA 812727bc4ea6a08416d204a1835d1db68c7826fa. Source pin verified; service ready 1/1. CI: https://github.com/QComputer/shadcn-rtl/actions/runs/41652523194

## Changes

- Product editing defaults to a bounded color-by-size inventory and price table. Full variant fields and gallery overrides remain available through details.
- New products can generate draft variants before their first save. Existing products require saved edits before server-side generation and reload persisted records after generation.
- Persian and Arabic numeric input is normalized separately from localized display. Lists accept Persian commas, ordinary commas, semicolons and newlines. Half sizes, repeated combinations and the 100-variant cap are checked.
- Generation previews are invalidated when inputs or editor state change. Stable saved-state snapshots avoid false dirty states caused by numeric base-price types or option key ordering.
- The generation route strips action metadata before strict validation and returns 400 for invalid settings.
- Hero Studio can preview the active published revision separately from the saved draft and warns before losing unsaved edits.

## Verified

- TypeScript, scoped ESLint and diff checks passed.
- Final focused unit run: 40 passed, zero failed. Includes the actual generation route with mocked merchant context, matrix rendering, input parsing, snapshots, generation and hero contracts.
- Hero PostgreSQL integration: passed against disposable PostgreSQL 17 on 127.0.0.1:55439, database retail_hero_test. Covers save/reopen, publication, rollback, media revocation and tenant boundaries.
- Local loopback HTTP acceptance using real catalog services and PostgreSQL passed: four new draft combinations saved/reopened, inventory and price override persisted, four half-size combinations generated, repeat preview adds zero. This harness uses a fixed synthetic tenant; it does not replace authenticated browser acceptance.

## Browser and Production acceptance

Browser connection recovered and interactive acceptance passed in real Chrome using the actual editor with local PostgreSQL-backed APIs. Verified Persian inventory and price save/reload, invalidation of outdated generation previews, half-size creation and automatic table reload, individual details, and first-save creation/reopen of six new-product variants. A 390px iframe preview showed the table's horizontal scrolling stays within its own container. Next navigation/image adapters were fixture-only; no physical Android test is claimed.

Production read-only acceptance on v13 verified all 33 variants in three actual color rows and eleven Persian size columns. Legacy/test definitions are ignored in favor of dimensions represented in this product. The generator defaults to the correct shoe color and size definitions. At the observed viewport, page height fell from 19,697px to 3,812px with no horizontal page overflow. Saved and active hero previews resolve to distinct immutable revisions; mobile preview is 390px wide. All four public health endpoints returned 200. Production product, inventory, price and hero content were not changed during acceptance.

External artifacts are under C:/Users/disso/.codex/visualizations/2026/11/01/01a19977-71e0-73f2-b983-744db19a5bb0/hero-release. The local fixture server and disposable container bazarbaaz-admin-20261103 were stopped after acceptance. The RunFlare source pin was updated and v13 deployed; no Production data or hero publication pointer was changed. External admin-release-v13-evidence.json records the final evidence and screenshot.

Preserve inherited migration SQL changes and untracked migration/audit artifacts. They are unrelated to this slice.
