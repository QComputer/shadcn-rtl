# Bazarbaaz Active Handoff

## Verified current status — 2026-11-14

### Main and merged work

- Fresh fetch: `origin/main` is `61d58fca0d9b31d35e0482cc614ab66c3284b0a0`.
- PR64 merged as `17bd558fa1facfffaa0f57081036cf950adf9d9b`; accepted PR head `8095e91f7282d59e5b81aacd10ea0b600d840c8a`; final isolated acceptance run [43498287992](https://github.com/QComputer/shadcn-rtl/actions/runs/43498287992) is SUCCESS. Earlier failed run 43494913875 is superseded. Do not repeat PR64 work or acceptance.
- PR66 and PR67 are merged; current main includes their dependency-security updates.

### Guest-request schema readiness

- Source on main: model `HotelGuestBookingRequest` in `prisma/schema.prisma`; additive migration `prisma/migrations/20261113150000_hotel_guest_booking_requests/migration.sql`, last touched by PR64 merge commit above.
- SQL creates one new table, its indexes and checks, and a composite FK to `HotelProperty(id, organizationId)`. The referenced unique key exists in the earlier Hotel persistence migration. PR64's successful isolated PostgreSQL 17 acceptance applies repository migrations from source. PR65's Node 24/PostgreSQL 17/Chromium run 43573800308 also passed prisma migrate deploy against a disposable database; its browser acceptance reported 12 passed.
- This establishes source and isolated-CI migration readiness only. Production `_prisma_migrations`, actual production schema parity, and the deployed Prisma client were not inspected. Read-only Runflare CLI event lookup returned no events; it did not establish migration application. Production migration state is **NOT_VERIFIED**.
- Migration is additive and has no rollback/down SQL. Do not apply or reverse it through this handoff. Before any operational guest-request enablement, verify the exact migration row and table/index/FK shape against the production database using an authorized read-only Runflare path; confirm the deployed client contains the model. No production database mutation was performed.

### Reception filter PR65

- [PR65](https://github.com/QComputer/shadcn-rtl/pull/65) is OPEN, non-Draft; source code HEAD is `0665f41248d77bdaeb8811da45ea5979339d5c7e`, and docs-only refresh commit `bb431589ed85bc4894f6ea3db1bb72209973ed3f` sits on the PR branch, base `main`. The PR diff contains no Prisma/schema/migration files.
- Isolated reception/PostgreSQL acceptance [43506947468](https://github.com/QComputer/shadcn-rtl/actions/runs/43506947468), focused regressions [43506947479](https://github.com/QComputer/shadcn-rtl/actions/runs/43506947479), and RunFlare TypeScript [43506947446](https://github.com/QComputer/shadcn-rtl/actions/runs/43506947446) all passed on source HEAD `0665`. After the docs-only refresh, the exact PR revision `bb431589ed85bc4894f6ea3db1bb72209973ed3f` also passed isolated acceptance [43573800308](https://github.com/QComputer/shadcn-rtl/actions/runs/43573800308), focused regressions [43573800251](https://github.com/QComputer/shadcn-rtl/actions/runs/43573800251), and RunFlare TypeScript [43573800242](https://github.com/QComputer/shadcn-rtl/actions/runs/43573800242). Run 43573800308 completed all 12 browser checks and disposable database/server cleanup. Vercel is suspended by owner decision and its check is blocked; CodeRabbit skipped. No required checks were reported and traditional branch protection was absent at inspection. PR65 has not been merged.
- Because Runflare auto-deploys main, do not infer live schema readiness or guest-request operational acceptance from PR65 CI. Keep production booking/hold/payment/SMS gates disabled until separately validated.

### Security follow-up PR68

- [PR68](https://github.com/QComputer/shadcn-rtl/pull/68) remains Draft. Security route-authorization commit `7420558eb39e5518942215dfbacc0909d7233432` scopes organization business-hours GET/PUT by authenticated organization membership; PUT also retains same-origin protection. A new route regression proves foreign-tenant reads/writes do not reach the service. The regression workflow was updated to run it.
- Focused unit run: 16 passed, 0 failed (business-hours schema, tenant-route behavior, and `requireOrgAccess` tests). Focused CI run [43573600243](https://github.com/QComputer/shadcn-rtl/actions/runs/43573600243) passed; RunFlare TypeScript [43573600176](https://github.com/QComputer/shadcn-rtl/actions/runs/43573600176) passed. Vercel remains suspended. Scoped local ESLint was not verified because the PR68 worktree has no installed dependencies.
- Preserve the additional uncommitted `lib/services/organization.service.ts` change in the PR68 worktree; it was intentionally not staged in commit 7420558e and has not been accepted or tested as part of that commit.

### Current workspace boundaries

- Shared checkout `C:/Users/disso/Project/shadcn-rtl` is currently on PR65 branch `codex/hotel-reception-readiness-20261113` at PR65 handoff snapshot `bb431589ed85bc4894f6ea3db1bb72209973ed3f`. Preserve its four inherited untracked files: `README.fa.md`, `docs/DAMOON-CHAT-KNOWLEDGE-HANDOFF-v1.1-FA.md`, `test-runner.sh`, and `typecheck.log`.
- `C:/Users/disso/Project/shadcn-rtl-damoon-phase1` is PR68 branch `codex/security-bounded-tenant-json-20261114` at `7420558e`, with the uncommitted organization service change above. Do not overwrite it.
- Other existing worktrees remain registered: hero-media (`d647f9a0`), Persian slug routing (`01d62ac1`), theme-speed/PR62 (`e29a13a2`), and Website Studio/PR59 (`72484637`); they were clean at the last status check. Do not remove or modify them for this task.
- PR60 remains an open Draft branch at `419fa846`; its former root checkout has been preserved as a branch. No main push, Runflare deployment, migration, payment, SMS, or production gate change was performed by this update.

### Next executable steps

1. Obtain authorized read-only confirmation of the production migration row and schema shape; until then, production guest-request schema status stays **NOT_VERIFIED**.
2. Keep PR65's three successful source/isolated checks as its acceptance evidence; decide merge only with the production auto-deploy consequence understood. Do not treat suspended Vercel as a passing test.
3. PR68 TypeScript and focused tests passed on `7420558e`; review the route changes and tenant regression, then separately assess the preserved service change and remaining business-hours edge cases before changing its Draft status.
4. Continue Damoon request/reception work using synthetic isolated tenants and keep operational booking gates disabled.

## PR64 acceptance update — 2026-11-13

- Run `43497811921` on `119293a75daa434575c1c383c1f6816a4a252435` passed PostgreSQL migrations, typecheck, lint, all 11 browser tests, disabled guest-request gate verification, and disposable database/server cleanup. Focused regressions and RunFlare TypeScript also passed on that SHA. These are isolated CI results, not production booking or payment acceptance.
- Earlier run `43494913875` exposed a duplicate-name locator; `1db454b6` scoped the card and message to the request ID. Run `43497261048` then exposed a stale version after a direct API availability recheck; `119293a7` exercises the actual reception button and waits for the UI to finish. Both failed runs cleaned their disposable database.
- Vercel is suspended by owner decision: `NOT_APPLICABLE — SUSPENDED`. Runflare remains the active deployment platform; do not deploy or modify Production as part of PR64 acceptance. No active main branch rules were returned by GitHub's branch rules endpoint and traditional branch protection was absent at inspection time.
- The subsequent commit removes an unused test helper and records this handoff; verify CI on its exact SHA before review or merge. Keep security gates intact and distinguish acceptance from release.

Updated: 2026-11-13. This is the operational resume point; older documents and CI results apply only to their recorded SHA and environment.

## Current source state

- `origin/main` freshly fetched and verified at `ec51d9c4b483db814b90f3d3daef2236977916e8`.
- PR64: [QComputer/shadcn-rtl#64](https://github.com/QComputer/shadcn-rtl/pull/64), Draft, PR head branch `codex/damoon-booking-requests-20261113`, base `main`.
- PR64 latest pushed HEAD: `d64c6295dda63736dbff259feeaf339d6846dc08`; local checkout branch remains `codex/damoon-booking-phase3-20261113`.
- Current task checkout: `C:/Users/disso/Project/shadcn-rtl-damoon-phase1`.
- Other registered worktrees are preserved. Do not edit or remove them: shared checkout (`codex/hotel-operational-payment-20261112`), hero-media, Persian-slug-routing, theme-speed/PR62, and Website Studio/PR59.
- Current follow-up fixes are limited to the reception requests route, `tests/e2e/damoon/booking-request-acceptance.spec.mjs`, and this handoff. Do not touch other worktrees or their files.

## Decisions and boundaries

- PR64 delivers a guest accommodation request and reception review workflow, not a confirmed reservation, payment, or live booking.
- Use an ephemeral GitHub-hosted runner with Node 24, PostgreSQL 17, repository lockfile, real Prisma migrations, Next API backend, standalone Damoon bridge, and Chromium. Avoid local heavy builds/fixtures while Windows C: has about 4 GiB free (last known; remeasure only if needed for a local operation).
- Only test-scoped gates may be enabled in isolated CI. Production booking, holds, cron, payment, SMS, Runflare settings/data, and real customer data remain untouched.
- Keep PR64 Draft until end-to-end acceptance and required checks pass. Merge only under the owner’s stated conditional approval and repository rules; never force-push.
- Codex is integration owner. Kilo/low-cost agents may handle bounded, non-overlapping tasks; no cost metrics were available. No agent should modify Production or overwrite another worktree.

## Evidence and open acceptance

- Previously reported bridge tests: 12/12 PASS (historical evidence; exact current SHA/run link was not present in the supplied handoff context).
- Local syntax checks passed. Targeted standalone bridge and Damoon source tests: **13/13 PASS** (covers test-only port allowlist, spoofed forwarding headers, and fail-closed missing upstream). This is not real PostgreSQL/browser acceptance.
- Hosted workflow run `43477620082` failed at TypeScript because the first version ran `tsc` before Prisma client generation. The order was fixed on `5684b296`.
- Hosted workflow run `43478096112` generated Prisma successfully, then failed typecheck on one fixture-only BigInt literal below the configured TS target. Commit `65c2824` fixes that and masks generated CI auth/manager secrets.
- Hosted workflow run `43478630027` passed install, Prisma validation/generation, full typecheck, lint, migrations, fixture seed, service startup and both bridge tests. It then failed at Playwright harness initialization because the redundant top-level `test.describe.configure()` call was invalid; commit `46e6792` removed it.
- Hosted workflow run `43479096680` reached the same harness stage and exposed split package versions (`playwright@1.61.1` CLI versus `@playwright/test@1.60.0` import). The current local diff aligns both imports with `playwright/test` to match the CLI. No browser tests executed yet.
- Hosted workflow run `43479603343` passed TypeScript and failed scoped ESLint on the now-unused `directUrl` local after exact URL string comparison; its removal is pending in the current local diff. No migration/browser flow ran in that attempt.
- Hosted workflow run `43484677796` on `f61453c...` passed setup, Prisma, typecheck, lint, migrations, seed and bridge checks, then failed browser acceptance (5/13 pass, 8 fail). The synthetic capacity issue was corrected. The option-selection test now reaches the request submit button, but no matching response arrived within Playwright’s 30s test timeout; the next run reports the form’s visible message after a bounded 10s response wait. The reception concurrency preflight had sent the rate-plan code in an availability field interpreted as a rate-plan ID, producing `NO_RATE_PLAN`; it now omits that optional field while retaining the code in the guest request. Other absent-reference/inbox failures cascade from the submit failure. Exact run: https://github.com/QComputer/shadcn-rtl/actions/runs/43484677796.
- Real PostgreSQL plus browser acceptance is **NOT_VERIFIED**. No successful persistence/browser evidence or merge result exists.
- A review found the guest status tracking form nested inside the booking form; the local edit moves it outside. This must be covered by browser acceptance.
- The focused hosted acceptance workflow now provisions a uniquely named disposable PostgreSQL 17 database, applies real Prisma migrations, seeds two synthetic tenants, starts the actual Next API and restricted standalone bridge, runs Chromium acceptance, verifies the disabled request gate, and drops only its named database. Browser tests cover FA request submission, EN/AR secure status tracking, reception review/status update, persistence, concurrent idempotency replay, tenant/host/origin isolation, optimistic concurrency, unapproved publication, out-of-range inventory, invalid references, no reservation/payment, and disabled gate. This workflow is still **NOT_VERIFIED** until it runs.
- Required acceptance includes FA/EN/AR, request persistence and secure status tracking, manager authorization/status update, idempotent replay, no reservation/payment creation, tenant isolation, Host/Origin/CSRF protections, disabled gates/unapproved publication, invalid reference, unavailable inventory, concurrency, and upstream failure. Mark any omitted case NOT_VERIFIED.
- Historical PR64 CI on `8fe27...`: RunFlare TypeScript and focused regressions reported PASS; Vercel was blocked. These are not evidence for later local edits or the pending PostgreSQL/browser flow.

## Exact next executable step

Commit and push the bounded submit diagnostic, then follow the hosted run. Use the UI message to diagnose why the request POST is not observed; ensure the flow completes without bypassing the public bridge. Confirm the rate-plan preflight is now available. Record full SHA, run URL and exact PASS/FAIL/NOT_VERIFIED matrix. Keep Draft; do not mark Ready or merge while any gate fails.

### Latest acceptance result

- Run `43485806963` for SHA `d52a06d78ef479890e8718eb990705efdd8b0221`: CI setup, migrations, seeding, typecheck, lint and bridge tests passed; browser acceptance failed 5/13. The visible form error was that child age validation rejected duplicate fields left mounted in both the search form and selected-room details panel. The current local patch changes collection to read only the active details panel and asserts the age is retained after selection.
- The next executable step is to push that focused UI fix and rerun the existing hosted acceptance workflow; follow through to disabled-gate verification and disposable DB cleanup. Keep PR64 Draft and do not merge until all acceptance gates pass.

### Latest acceptance result and current resume point

- Run `43486804461` for SHA `6d9a2445ac6078438516e69966c60beeae7dc6ce`: setup, Prisma, typecheck, lint, migrations, fixture seed and bridge tests passed. Browser acceptance passed 8/13; FA guest submission/tracking and EN/AR status tracking passed. Reception inbox polling timed out. The fixture managers were not marked `isTeamMember`, so the auth callback did not derive their organization context from active membership; the seed now marks the manager/admin fixtures as team members and includes bounded inbox diagnostics. Run `43487839146` for `844cd4da...` then failed typecheck because `organizationId` was mistakenly added to `User`, a field not present in the Prisma model; the local fix removes it and sets `isTeamMember`. Runs: https://github.com/QComputer/shadcn-rtl/actions/runs/43486804461 and https://github.com/QComputer/shadcn-rtl/actions/runs/43487839146.
- Next: push the corrected team-member fixture, then follow the hosted flow through reception status changes, tenant denial, idempotency, disabled gate and disposable database cleanup. Keep PR64 Draft until all gates pass.

## Next milestones

1. **Isolated acceptance:** real PostgreSQL-backed guest-to-reception browser flow and focused negative security cases pass; disposable resources are cleaned up.
2. **PR review/merge:** required CI passes, PR64 is Ready for Review, acceptance evidence is attached, and merge follows repository rules. Production gates remain disabled.
3. **Controlled operational enablement preparation:** separately validate actual publication, inventory, routing, and staffing readiness; Production activation requires its own explicit authorization and is outside PR64.

### Latest acceptance result and exact resume point (2026-11-13)

- Run `43488214881` for `3510412e21a556410c9ac97ceeb6ec1c3d6dcd4e`: hosted PostgreSQL 17 setup, real migrations, synthetic two-tenant seed, TypeScript, ESLint and bridge checks passed. Browser acceptance was 9/13. FA submission/status and EN/AR tracking passed. Reception UI polling failed because the test clicked a refresh button not present in the rendered inbox; dependent foreign-reference, reception concurrency and idempotency tests then failed because the worker restarted and their values were held only in module globals. Run: https://github.com/QComputer/shadcn-rtl/actions/runs/43488214881.
- Run `43491292686` for `04eb1f8fef55e6bd55c72f5e9b3b8db5f1434a5e`: setup, Node/pnpm install, PostgreSQL 17, migrations, seed, TypeScript, ESLint, service startup and bridge passed. Browser was 9/11. The diagnostic recorded the manager page URL as `/fa/dashboard` and no inbox landmark. The cause is confirmed: `/hotel-website/[organizationId]/[propertyId]/requests` was absent from `DASHBOARD_ROUTE_POLICY`; the authenticated client access hook consequently treated it as unknown and redirected to dashboard overview. API authorization itself succeeded. Disposable DB and containers were cleaned. Run: https://github.com/QComputer/shadcn-rtl/actions/runs/43491292686.
- Run `43492667524` for `fed400edcef61354f2c674cb3311a274e06822f4`: typecheck, lint, migrations, fixture seed, startup and bridge passed; browser remained 9/11. Both reception tests still found `/fa/dashboard` because `lib/access-control.ts` also lacked the route. The existing redirect hook uses that registry, so adding only `DASHBOARD_ROUTE_POLICY` was insufficient. Other replay/tenant/locale checks passed, and cleanup completed. Run: https://github.com/QComputer/shadcn-rtl/actions/runs/43492667524.
- Run `43492309364` for `d64c6295dda63736dbff259feeaf339d6846dc08` stopped at TypeScript: the new test passed unsupported `HOTEL_WEBSITE` to a route API whose capability type only includes business capabilities. No browser tests ran. This is test typing only; the CMS server authorization still independently checks `HOTEL_WEBSITE`. Run: https://github.com/QComputer/shadcn-rtl/actions/runs/43492309364.
- Run `43493519342` for `da0b1a865ef46062cdb0b09fae78ac5747b882f0`: TypeScript, lint, route-policy tests (3/3), bridge tests (2/2), PostgreSQL migrations/fixture setup and startup passed; browser remained 9/11. Both reception cases still found `/fa/dashboard`. Root cause: synthetic tenants left `capabilitiesInitializedAt` null, so `/api/users/me/membership` fell back to organization type (`SHOP`) instead of returning seeded `HOTEL_WEBSITE`, and the client route hook denied the reception route. Disposable database/containers were cleaned. Run: https://github.com/QComputer/shadcn-rtl/actions/runs/43493519342.
- Run `43494252922` for `3dc7016a2ce61df35d0740477c2b66476fae2cbf`: setup, typecheck, lint, route tests, bridge and real PostgreSQL fixtures passed; browser remained 9/11. Server logs prove the normal reception endpoint returned 200 to the helper request that injected `Origin`, then 403 to the component's browser GET on the same route. The page URL stayed on the authorized reception route after fixture initialization. Playwright traces/screenshots are disabled, so no trace artifact was emitted. This confirms `managementAction` incorrectly applied mutation CSRF validation to GET.
- Current local fix skips mutation-origin validation only for GET/HEAD in `managementAction`; session authentication and organization authorization still run. `managementRequest` and POST/PATCH management actions retain `requireSameOriginMutation`. The browser acceptance now asserts its ordinary fetch has no Origin header and receives 200, and checks cross-origin POST/PATCH are rejected. Immediate next step: syntax/diff validation, push this narrow fix and handoff, then run the focused hosted acceptance once. Keep PR64 Draft until all 11 browser tests, disabled-gate test, and mandatory checks pass.

## Continuity

Do not reconstruct prior chats. Inspect this handoff, current Git state and the PR diff; treat this file’s historical facts as stale until revalidated. Never copy credentials, connection strings, private customer data, or preservation-archive contents into Git.
