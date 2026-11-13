# Bazarbaaz Active Handoff

Updated: 2026-11-13. This is the operational resume point; older documents and CI results apply only to their recorded SHA and environment.

## Current source state

- `origin/main` freshly fetched and verified at `ec51d9c4b483db814b90f3d3daef2236977916e8`.
- PR64: [QComputer/shadcn-rtl#64](https://github.com/QComputer/shadcn-rtl/pull/64), Draft, branch `codex/damoon-booking-phase3-20261113`, base `main`.
- PR64 candidate/local HEAD: `8fe27ccc282892247be0da21f357ccce64b5db74`. This SHA predates the uncommitted changes listed below.
- Current task checkout: `C:/Users/disso/Project/shadcn-rtl-damoon-phase1`.
- Other registered worktrees are preserved. Do not edit or remove them: shared checkout (`codex/hotel-operational-payment-20261112`), hero-media, Persian-slug-routing, theme-speed/PR62, and Website Studio/PR59.
- Current PR64 work includes modified `sites/damoon/api-proxy.mjs`, `sites/damoon/booking.js`, and `sites/damoon/tests/standalone-api-proxy.test.mjs`; new `.github/workflows/damoon-booking-acceptance.yml`, `playwright.damoon.config.mjs`, `scripts/hotel/seed-damoon-booking-e2e.mts`, `scripts/hotel/verify-damoon-disabled-request-gate.mjs`, `tests/e2e/damoon/`, and these two handoff files. No commit or push is represented by this handoff.

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
- Real PostgreSQL plus browser acceptance is **NOT_VERIFIED**. No successful persistence/browser evidence or merge result exists.
- A review found the guest status tracking form nested inside the booking form; the local edit moves it outside. This must be covered by browser acceptance.
- The focused hosted acceptance workflow now provisions a uniquely named disposable PostgreSQL 17 database, applies real Prisma migrations, seeds two synthetic tenants, starts the actual Next API and restricted standalone bridge, runs Chromium acceptance, verifies the disabled request gate, and drops only its named database. Browser tests cover FA request submission, EN/AR secure status tracking, reception review/status update, persistence, concurrent idempotency replay, tenant/host/origin isolation, optimistic concurrency, unapproved publication, out-of-range inventory, invalid references, no reservation/payment, and disabled gate. This workflow is still **NOT_VERIFIED** until it runs.
- Required acceptance includes FA/EN/AR, request persistence and secure status tracking, manager authorization/status update, idempotent replay, no reservation/payment creation, tenant isolation, Host/Origin/CSRF protections, disabled gates/unapproved publication, invalid reference, unavailable inventory, concurrency, and upstream failure. Mark any omitted case NOT_VERIFIED.
- Historical PR64 CI on `8fe27...`: RunFlare TypeScript and focused regressions reported PASS; Vercel was blocked. These are not evidence for later local edits or the pending PostgreSQL/browser flow.

## Exact next executable step

Commit and push the focused lint fix to the existing PR64 branch. Follow Actions through the Chromium flow, disabled-gate check and disposable database cleanup. Record its full SHA, run URL, actual PASS/FAIL/NOT_VERIFIED matrix and next step here. Keep Draft and do not merge while any acceptance gate is incomplete.

## Next milestones

1. **Isolated acceptance:** real PostgreSQL-backed guest-to-reception browser flow and focused negative security cases pass; disposable resources are cleaned up.
2. **PR review/merge:** required CI passes, PR64 is Ready for Review, acceptance evidence is attached, and merge follows repository rules. Production gates remain disabled.
3. **Controlled operational enablement preparation:** separately validate actual publication, inventory, routing, and staffing readiness; Production activation requires its own explicit authorization and is outside PR64.

## Continuity

Do not reconstruct prior chats. Inspect this handoff, current Git state and the PR diff; treat this file’s historical facts as stale until revalidated. Never copy credentials, connection strings, private customer data, or preservation-archive contents into Git.
