# Retail variant deletion — PR 47 continuation

The owner withheld release approval for PR 47 and requested color, size and
exact-combination deletion in the same package. Development continues on
`codex/retail-pilot-phase2-20261110` after accepted development SHA
`219ecc54cfe5b80501424a45e6a5c0f2c000d458`. Its six preceding commits and their
Retail/Damoon acceptance remain preserved. Production remains the separately
owner-accepted `382d90a7689a00ea142dfffb83e8a817d9a7a0b4`.

## Implemented contract

- Draft and persisted variants support color-row, size-column, exact-cell,
  full-editor group and individual deletion. Confirmation, pending status and
  undo are localized in Persian, English and Arabic. Failed saves retain the
  pending edits. Undo restores variant identity, values and original order.
- Persisted deletion is an explicit, revision-checked PATCH inside a single
  serializable transaction. Product and variant locks align with checkout.
  Invalid/foreign/duplicate IDs, update/delete overlap, stale revisions,
  reserved stock and unresolved order/payment activity fail atomically.
- Deleted rows keep their ID, unique SKU, option values, historical order and
  inventory references. Retail legacy delete/hard-delete paths are closed.
  Regenerating a deleted combination creates a new ID and unique SKU.
- Live color/gallery/appearance references are pruned. Media files and
  historical rows are retained. A published product cannot lose its final
  purchasable variant without explicit atomic unpublishing.
- Old cart lines remain visible as unavailable and removable; quantity changes
  and checkout reject. Checkout locks also protect inventory-untracked variants.
  PostgreSQL serialization/deadlock conflicts from raw SQL become controlled
  conflicts; checkout retries its entire transaction within its existing bound.

## Verification

Acceptance is complete and recorded in
`evidence/2026-11-10/variant-deletion-validation.json`. Backend commit
`14a02e3`, UI commit `3aa98a2` and regression commit `58b5a73` extend the six
previous commits. Full isolated webpack build passed, including TypeScript
and all 344 static pages. Scoped lint passed with zero warnings.

The final built-local deletion run is
`.tmp/retail-recovery/1794310477928e68d11a2/result.json`: all six browser
scenarios and all 11 PostgreSQL deletion tests passed, exit 0 and cleanup
`PASSED`. The browser cases include a stale-save 409 retaining pending edits,
save/reload, full-editor group deletion, last-variant atomic unpublish, stale
customer cart removal, and mobile dark-mode deletion/cancel/undo in fa/en/ar.

The seven existing built-local browser regressions passed separately on the
same unchanged application build in
`.tmp/retail-recovery/1794310131866367665e2/browser-results.json`. That earlier
invocation's overall `FAILED` result is retained because its deletion browser
suite still used a hidden-select locator. Do not relabel the whole run PASS.

The focused unit gate contains 39 tests including deletion contracts, draft
undo/orderability, localized matrix sizes, generation, cart, checkout and order
operations. The disposable PostgreSQL deletion suite contains 11 tests, with
real order/payment/history, reserved-stock rollback, tenant and stale-quote
checks, plus an actual untracked-checkout/delete lock race.

Earlier rejected attempts remain under `.tmp/retail-recovery/`: fixture schema
defaults, missing foreign variant, ancestor TestContext deadlock, synthetic
USSD hash/factor constraint errors, browser status/hidden-select selectors and
empty-cart fixture handling, and the raw-SQL conflict mapping exposed by the
race. These attempts are not passing acceptance. Each runner cleanup
passed. The corrected services-only run is
`.tmp/retail-recovery/17943095646284c7b4a87/result.json` (`PASSED`, exit 0,
cleanup `PASSED`). Provider-shaped rows are synthetic, local fixtures only.

`--variant-deletion-browser-only` explicitly scopes browser execution to the six
new deletion scenarios; all disposable service regressions still run. This
does not claim the seven pre-existing browser scenarios ran in that invocation.
The receipt records their separate successful execution on the same unchanged
application build. This avoids repeating accepted browser work for test-only
selector fixes.

## Release and preservation boundaries

No main push or Production operation is authorized by development completion.
Update PR 47 and request one approval for its final consolidated release SHA.
Runflare is the Production reference and its dashboard/deployment review is
owner-operated. An external Vercel preview check is reported separately; no
required check, deployment setting or account restriction is bypassed.

Hotel operational holds, Cron, real payments, SMS and sensitive booking remain
disabled. No migration or dependency update is included. The nine inherited
tracked edits, `test-runner.sh`, `typecheck.log` and private Retail recovery
archive remain outside the feature commits. One shared checkout is retained.
