# BazarBaaz master takeover — 2026-11-10

## Verified baseline

Inspected shared main at `bb25c09499de37e63d158a14921c82e9971eaf7e`.
Fresh `git fetch origin` succeeded; main and origin/main had zero divergence.
Retail checkout `agent/retail-ui-acceptance` was clean at
`5e918944acdc5de3fbb3054d366868f5a9c54019`. That SHA is an ancestor of main:
13 main-only commits, zero Retail-only commits. Merge `4f5586c` already
integrated Retail; no replay, merge or cherry-pick is necessary.

Inherited edits preserved: AGENTS, eight handoff/status documents, and
`scripts/db/deploy-retail-theme-media.mjs`; untracked `test-runner.sh` and
`typecheck.log`. The latter log alone has no durable completed exit result.
The shell defaults to Node 22; validation used installed Node **24.22.1** at
`C:/Users/disso/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.
pnpm is 10.15.0. Kilo/kilocode were unavailable in the current PATH and checked
app-install locations. Three bounded low-cost Codex auditors reviewed Retail,
Hotel and Git. The main agent retained Git and acceptance ownership.

## Current evidence

- Exact baseline CI [Hotel PostgreSQL acceptance](https://github.com/QComputer/shadcn-rtl/actions/runs/42656515861)
  completed successfully: 24 passed, zero failed/skipped, on `bb25c09`.
- Exact baseline CI [RunFlare TypeScript](https://github.com/QComputer/shadcn-rtl/actions/runs/42656515779)
  completed successfully on the same SHA. These establish source gates, not
  deployed runtime or Production operational acceptance.
- New local Hotel guard: 15 unit tests passed, exit 0. It requires acknowledged
  disposable loopback URLs, pinned port, dedicated DB name, PostgreSQL adapter,
  and rejects Production and connection overrides. The integration fixture also
  requires an empty organization table before enabling its local Cron gate.
- New local Hotel PostgreSQL run: migrations exit 0; 24 tests passed, zero
  failed/skipped, exit 0. Fresh DB
  `bazarbaaz_hotel_expired_holds_verify_20261110` on loopback port 5436 was created
  for this run and dropped in finally. Durable local result:
  `.tmp/master-20261110/hotel-result.json`, `status=PASSED`, `exitCode=0`,
  `cleanup=PASSED`. This is baseline plus the uncommitted guard changes.
- Hotel booking-service unit tests: 32 passed, zero failed/skipped, exit 0.
- Final focused selection: 80 tests (Retail 65 plus Hotel guard 15), zero
  failed/skipped, exit 0. A separate spreadsheet/Persian-number selection passed
  17/17; Retail recovery safety passed 6/6. Booking-service unit 32/32 is above.
- Full `tsc --noEmit --incremental false --pretty false` passed. The final
  isolated `pnpm build --webpack` passed, including built-in TypeScript and
  all 344 static pages. Scoped lint over changed app/server/test files passed
  with zero warnings. Logs are in `.tmp/master-20261110/`.

## Runtime source corrections

The build exposed a non-standard prop on the default shop Page export. Shared
shop rendering now lives in `shop/shop-content.tsx`, while route entrypoints
receive only supported Next Page props. Both the organization root and `/shop`
retain their existing catalog/legacy selection behavior.

Real browser/API checks exposed two independent catalog mutation defects:
wrong-tenant/unavailable cart variants produced generic 500 errors, now scoped
404 responses; and bulk import discarded `base_price_toman` while merging
product rows, so new-product import could never satisfy required base price.
The grouping now retains the field and rejects conflicting row values through
the existing consistency check. No schema/migration or authorization expansion.

The inherited media migration checksum correction was checked against both
working bytes and Git blob bytes (identical SHA256 `4bdd69e53ba42b7bfdfc876d0984913b44d183873efea40ea6e18816ca112b62`),
syntax-checked and accepted in its own commit. No migration was applied to any
shared or Production database.

## Retail recovery and workspace closure

Prior November 9 UI logs show Prisma P1001 on local `127.0.0.1:5436` during
login and product/organization reads. A short Secret was not established as
the cause. Default Docker context commands hung; bounded direct access using
`docker --host npipe:////./pipe/docker_engine_linux` succeeded. `pg-cron`
(`postgres:16`) serves disposable local test databases on 5436.

The old ignored acceptance artifacts must survive checkout removal. Private
recovery ZIP:
`C:/Users/disso/.codex/recovery/bazarbaaz-retail-20261110/ignored-recovery.zip`.
All 26 entries were read back and individually verified against SHA256 in
the sibling `manifest.json`; ZIP SHA256:
`8ABA7A714E8533A95C5CDB5BE6898A7A9ADC006BDFF056D35040754AE88DDD1C`.
It preserves all `.tmp`, `test-results`, `next-env.d.ts` and
`tsconfig.tsbuildinfo`. Installed dependencies and generated `.next` are
reproducible, not unique source. Branch/history remain preserved in Git.

Normal `git worktree remove` removed the Retail registration but failed to
remove the entire directory. Its `node_modules` was a junction to main's
dependencies; Git traversed it and partially removed shared packages. The
remaining directory was moved (same volume, no recursive deletion) to the
private recovery root's `filesystem-residual`. The junction metadata is saved
in `detached-junction.json`; the link was then detached using non-recursive
`Directory.Delete`, leaving main's target intact. Do not recursively delete
linked recovery directories. Main's dependencies were restored with Node 24:
`pnpm install --offline --force --frozen-lockfile --ignore-scripts` (exit 0,
858 packages reused, zero downloaded); package.json and lockfile are unchanged.
Full TypeScript subsequently passed including the recovered Retail suite.
`git worktree list --porcelain` now contains only main. Both interrupted local
Retail attempts cleaned up their newly created test database; browser acceptance
must come from a completed subsequent run.

The maintained Retail executable and guarded fixtures are in
`tests/e2e/retail-recovery/`, with lifecycle orchestration in
`scripts/e2e/retail-recovery-local.mjs`. See
`RETAIL-UI-RECOVERY-2026-11-10.md` for the reproducible command and safety gates.
Recovered tests required CUID fixtures, current selectors, exact navigation,
real POST/save assertions, and persisted imported-variant checks. Earlier
failures are retained as environment/harness defects; they are not acceptance.

## Accepted local Retail run

All six browser scenarios passed against the locally built app: generated ten
custom-color/size combinations and reloaded; edited/reloaded existing product
name/SKU/price/inventory; selected the exact custom-color variant, added to cart
with HTTP 201 and verified persistence after reload; rejected a real foreign
tenant cart variant with HTTP 404 and foreign merchant product access; uploaded,
previewed and executed XLSX and read persisted base price/custom options/stock;
verified organization-root and `/shop` catalogs and RTL mobile product controls
at 375x812, with no add-to-cart buttons on catalog cards.

Authoritative local run:
`.tmp/retail-recovery/1794275488069995a6512/result.json` has `status=PASSED`,
`exitCode=0`, `cleanup=PASSED`, browser passed 6, failed/skipped 0. Its source
base is `6f7a6471602c27cc268f42b85e55e20d30339c14` plus the now-committed test
harness; `sourceDirty=true` is intentional. Migrations, guarded seed, Cafe
regression and browser process all exited 0. The newly created test database
was dropped and the owned app server stopped. Cafe regression passed 1/1,
including catalog idempotency, foreign-tenant guard and order behavior. This
does not establish deployed Cafe acceptance or real orders/payments.

The compact durable summary is
`evidence/2026-11-10/master-validation.json`. Initial `test-runner.sh` and
`typecheck.log` remain preserved and uncommitted; the script was not invoked
because it installs unpinned dependencies and migrates without a local guard.

## Commits and review package

- `8f1442c`: disposable Hotel cron acceptance guard and CI guard tests.
- `1b91c61`: Next route props, grouped-import base prices and scoped cart 404s.
- `6f7a647`: verified inherited media migration checksum correction.
- `c7f1eab`: guarded, repeatable Retail/Cafe/browser acceptance.

Review branch: `codex/bazarbaaz-master-20261110`. Main is retained as the single
local checkout. Push only the review branch; do not push main or deploy until
the owner gives the single approval for this reviewed release package. The nine
inherited tracked documentation/AGENTS edits and the two inherited untracked
files remain separate. No reset, stash, force removal or branch deletion used.
For final candidate CI, look up the exact candidate SHA (not the baseline runs
above) with `gh run list --commit <candidate-sha>`; the Hotel PostgreSQL and
RunFlare TypeScript workflows support manual dispatch on the review ref.

## Boundaries and remaining release gates

Keep one active main checkout. The root `ai-handoff.md` entry has been restored;
the old linked `docs/AI_HANDOFF_ROADMAP.md` is absent. November 5 handoff SHA and
dirty-state descriptions are historical, not current Git evidence.

RunFlare project/app identifiers `37622`/`87432` are dated source records, not
a fresh dashboard check. No RunFlare dashboard, Production settings, provider,
real payment/booking/SMS or operational Cron action was taken. Preserve
`HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED=0` and
`HOTEL_CRON_SCHEDULER_ENABLED=0` outside disposable local tests. Main push can
deploy automatically: prepare and review the release package before requesting
the single owner release approval. Public deployment, real merchant acceptance,
Restaurant/Cafe runtime and physical Android/PWA remain separate gates.
