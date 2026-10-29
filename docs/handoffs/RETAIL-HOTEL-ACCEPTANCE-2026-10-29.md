# Retail merchant acceptance and Hotel continuation — 2026-10-29

## Outcome and source

The local merchant edit/save/reopen/reload slice passed against the consolidated
single-main checkout. The starting HEAD was
`5806d68eef9f365059e39b9381d2f60b7bf0094b`; the only application change in this
slice is the `AttributeControl` ID correction in
`components/dashboard/retail-product-editor.tsx`.

Repeated variant attribute controls previously derived their DOM IDs solely
from the attribute definition. Two size fields therefore shared one ID, both
labels were associated with the first input, and the second input had no native
label. The actual Chrome run reproduced this failure. Each control now uses
React `useId()`. The completed browser run checks two accessible size controls,
distinct IDs and correct native label associations before editing, after
reopening and after reload. An independent static review found no further issue.

## Local environment and evidence

The test used synthetic footwear tenants, products and manager accounts, not
the real `aka-shoes` organization. It exercises the same merchant and FASHION /
SHOE_STORE contracts used by that organization. The second synthetic merchant
belongs to another organization. No shared provider configuration was loaded.

- Existing PostgreSQL 17 QA database:
  `127.0.0.1:55432/bazarbaaz_retail_r3`.
- Exact container: `bazarbaaz-retail-r2-pg17-20261013`; its original initialization
  database is R2, while the verified live test connection targets R3.
- Thirteen valid pending repository migrations were deployed only to this QA
  database. An empty, untracked historical migration directory was removed;
  its original SQL remains in the private consolidation archive. The resulting
  migration chain contains 110 valid directories.
- Existing compiled production runtime was rebuilt after the source fix and
  served only on loopback port 3100. Chrome used real UI, HTTP and database-backed
  routes, without API mocks.
- Private evidence directory:
  `C:/Users/disso/.codex/artifacts/retail-hotel-delivery-20261029`.
  Credentials and runtime JSON in that directory must not be committed or copied
  into ordinary development environment files.

The completed Chrome run verifies:

1. Anonymous merchant-product GET receives HTTP 401.
2. Authenticated merchant reads and edits the exact owned product.
3. Inventory tracking changes from false to true; both variants retain distinct
   names, SKUs, prices, inventories, sizes and backorder policies.
4. Same-tenant media selection goes through the library UI; PATCH carries the
   intended IDs and values, and an independent GET rereads the persisted data.
5. Publication is performed through the explicit merchant UI action.
6. Leaving/reopening and browser reload rehydrate all edited input values,
   inventory policy, option labels, publication controls and the loaded image.
7. The second merchant receives HTTP 404 when reading the first tenant's product.
8. Anonymous public product API returns the edited product and variant prices.
9. Anonymous product and catalog pages render on desktop and at 390px mobile
   width without horizontal overflow. Six screenshots were captured.

The fixture lifecycle records manifest-owned IDs and fingerprints every public
table before fixture creation. Cleanup removed only those owned rows, verified
that no order or cart had been created, and matched every table count/hash to
the baseline. This restores the post-migration, pre-fixture data state; it does
not roll back the QA schema migrations. The app server and QA container were
stopped. Final acceptance requires `status=PASSED`, `exitCode=0`,
`cleanup=PASSED` in the top-level private `result.json`.

## Validation and retained failures

- Full webpack production build: exit 0, 337 pages; TypeScript phase passed.
- Scoped ESLint on the changed editor: exit 0, no diagnostics.
- Five focused catalog/gallery/attribute/shared-shop test files: 50/50 passed
  after the fix.
- Public catalog and tenant-capability/access contract tests: 43/43 passed with
  explicit isolated runtime configuration.
- `git diff --check`: passed.

Earlier unsuccessful runs remain separate evidence. They include missing local
auth configuration, the original duplicate-ID application defect, a harness
selecting a hidden responsive card, and an overly strict optional-filename
assertion. The final media assertion checks persisted image identity and actual
image loading. A standalone typecheck overlapped build regeneration and lost
generated `.next/types` files; the later full build's TypeScript phase passed.
The first supplemental contract invocation lacked `DATABASE_URL`; the explicit
local-configuration rerun passed 43/43. None of those initial failures is counted
as successful acceptance. Existing metadata `themeColor` deprecation warnings
were visible at runtime and are outside this focused fix.

## Damoon and next boundaries

A parallel local Chrome sample reviewed Persian, English and Arabic rooms,
café/restaurant, gallery and contact pages. No guest-facing defect was found.
Concept imagery is labeled, and the date/guest flow remains contact coordination
with an explicit statement that online booking is unavailable. This sample is
separate from the earlier consolidation's 210/210 local route acceptance.

Retail next: perform a reviewed hosted release and verify the real `aka-shoes`
domain, owner session and persisted catalog through supported workflows. Order,
payment, fulfillment and physical PWA acceptance remain separate milestones.
The focused shared-contract tests are not live Restaurant/Cafe acceptance.

Hotel next: continue `sites/damoon` using approved real hotel photos/logo,
actual tour media and approved menu/contact content. Operational booking needs
approved rates, inventory and policies, followed by its own end-to-end evidence.
The local preview server's all-interface binding is an optional separately
scoped development improvement, not an observed public-site defect.

No push, RunFlare deployment, production database mutation, real payment or real
booking was performed in this slice. A push to main may trigger Auto Pull, so
the reviewed local candidate and hosted release must remain distinct.
