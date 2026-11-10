# BazarBaaz development phase 2 — 2026-11-10

## Accepted baseline and working rules

The owner accepted Runflare deployment of
`382d90a7689a00ea142dfffb83e8a817d9a7a0b4`. Recovery and that release are
closed; do not repeat its dashboard/log/health checks without new evidence.
The owner still controls Production deployment inspection and secrets.

Use the single checkout on `codex/retail-pilot-phase2-20261110`; no additional
worktrees. Main remains at the accepted release. Preserve the nine inherited
tracked documentation/AGENTS changes, `test-runner.sh`, `typecheck.log`, and
the private Retail recovery archive. Stage only owned paths. Development branch
pushes are authorized; the next main release needs one package approval.

## Source-verified priorities

1. Retail cart reliability: a removed cart line returned generic HTTP 500 on
   stale PATCH/DELETE; the UI kept displaying the stale line. Return scoped
   404 and reload the authenticated tenant cart without retrying the mutation.
   Verify both stale update and stale delete through real local HTTP/browser.
2. Retail checkout acceptance: prove cart quantity changes invalidate a reviewed
   quote without order/coupon/stock writes, then prove a fresh quote completes
   once and an idempotent retry has no duplicate effects. Existing price-change
   coverage does not establish the cart-change case.
3. Damoon manual-contact flow: the room detail's contact link omitted children
   and ages, and contact summary omitted children. Preserve the full stay plan
   through a fresh-session contact URL in fa/en/ar. This is contact planning,
   not availability, pricing or booking acceptance.
4. Account recovery remains unavailable until an approved verified delivery
   channel is configured. Current source already implements password-change
   session invalidation and guarded recovery logic; do not redo those features
   or enable a provider based on an old backlog report.

Bounded current-source audits found no new demonstrable P0 tenant defect in
Retail cart/checkout. This is not a comprehensive security certification.
Existing Hotel CMS/publication unit and PostgreSQL tests already cover the
suggested publication slice; avoid duplicate work. Real pilot/provider and
physical Android acceptance remain separate.

## Initial independent commit

`20adb84`: rejected foreign-tenant POST/PATCH/DELETE preserve the original cart.
Pushed to the development branch. Reviewed diff; Node syntax and scoped ESLint
passed. Repeated built-local browser acceptance passed 6/6, Cafe regression
passed, migrations/seed exited 0 and disposable cleanup passed:
`.tmp/retail-recovery/179429944425794d71294/result.json`.

## Implemented development commits

- `e7810dd`: standalone Damoon server now serves the imported `booking-flow.js`;
  a real HTTP module-graph regression covers all transitive app imports and
  retains the server-source deny rule. This fixes standalone preview startup;
  it is not evidence of a Production outage.
- `216e670`: Damoon room contact links retain children and validated ages;
  localized summaries show the full family plan, including after a fresh-session
  direct URL. Source locale initialization now matches the already-correct
  public bundle. Source and shared-public bundles are both browser-tested.
- `a54502b`: scoped missing-cart-item 404s, UI refetch without mutation retry,
  stale PATCH/DELETE browser regression, and disposable quote-change/checkout
  idempotency regression. The runner also supports focused `--services-only`.
- `33699d1`: pull-request CI runs the 15 focused Retail units and seven Damoon
  helper/real-HTTP tests using locked dependencies and placeholder local DB
  configuration. Browser and disposable checkout acceptance remain explicitly
  local evidence; CI does not silently skip those tests and claim them passed.

The source/public Damoon apps already differed in unrelated virtual-tour work.
A full synchronization was deliberately not performed. Only the family-plan
changes were mirrored to `public/damoon-front/app.js`, with its manifest hash
updated; existing assets and unrelated public behavior were preserved.

## Local acceptance

Current Retail run: `.tmp/retail-recovery/179430055218727d5c6e9/result.json`.
It passed migrations, guarded seed, Cafe regression, checkout regression, and
all seven browser scenarios; zero failed/skipped, exit 0, cleanup PASSED.
This is **development-local** acceptance, using the changed Retail files later
committed in `a54502b`; its recorded source base is `20adb84` and dirty=true.
The inherited owner files remain dirty throughout. It is not deployed or real
merchant/payment acceptance. The initial independent commit's six-scenario
built-local run is recorded above.

Focused Retail units: 15 passed, zero failed/skipped. Full TypeScript exited 0
(`.tmp/phase2-20261110/typecheck-final.log`). Scoped Retail lint exited 0 with
zero warnings. Damoon source/public JavaScript lint has zero errors and two
pre-existing unused `path` parameter warnings, one in each app copy; strict
zero-warning lint is therefore not claimed for those existing files.

Damoon focused suite: eight passed, zero failed/skipped, exit 0
(`.tmp/phase2-20261110/damoon.log`). Its browser test covers source and shared
public files, all three locales, fresh-context URL rehydration, and removal of
stale ages when children becomes zero. The remaining seven tests cover booking
helpers and the standalone HTTP module graph.

Earlier rejected attempts are retained: the first checkout fixture used a
lowercase coupon code, fixed to the service's uppercase contract; the first
development browser run hit the cold compilation navigation timeout (6/7,
not PASS); and a parallel typecheck observed generated files being replaced
by Next dev. The accepted typecheck ran with the app stopped; the accepted
browser run used the corrected navigation timeout. All temporary DB cleanup
results passed. Do not replace failed evidence with PASS labels.

Full isolated `pnpm build --webpack` exited 0 at application commit `a54502b`:
Prisma generation, built-in TypeScript and all 344 static pages passed. Cache
was off and typecheck was not skipped. DB configuration was a loopback
placeholder; no hosted database or provider was used. Durable log/result:
`.tmp/phase2-20261110/build.log` and `build-result.json`.

Optimized-runtime acceptance also passed at source `33699d1` (application files
unchanged from `a54502b`):
`.tmp/retail-recovery/17943014210624e1fe06c/result.json` records built-local,
seven browser scenarios passed, zero failed/skipped, exit 0 and cleanup PASSED.
Migrations, fixtures, Cafe and checkout service regressions all exited 0.
This is the current authoritative local release acceptance. The development
run above remains separate evidence. No owned app server was left running.

The compact tracked receipt is `evidence/2026-11-10/phase2-validation.json`.
Check the development PR for final-tip CI, not an earlier workflow run. The
final CI observation is retained in `.tmp/phase2-20261110/candidate-ci.json`.

## Remaining boundaries

No new Production release has been authorized. Hotel anonymous holds and Cron
remain off; no provider, real payment, SMS, booking or secret changes occurred.
The account-recovery verified delivery channel is a separate owner decision;
the service remains fail-closed. Do not invent a provider or send messages.
No further concrete wrong-variant defect was found in a bounded nine-file
storefront audit; existing exact-variant and Persian-size behavior was retained.
