<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared main checkout

The owner chose one active checkout for this repository:
`C:/Users/disso/Project/shadcn-rtl`, normally on `main`.
Do not create additional worktrees by default. Coordinate subagents by explicit
non-overlapping file ownership in this checkout, and serialize Git operations.
Inspect current Git state before editing; preserve inherited work.

Read `docs/handoffs/SINGLE-MAIN-2026-10-29.md` for the consolidation record,
private recovery archive, deferred source and Hotel/Retail continuation points.
Historical branch documents and acceptance results describe their own SHA and
environment; verify the current baseline before relying on them.

Use the repository's locked dependencies. Keep local development and tests on
isolated configuration; archived `.env`, database dumps, `.neon` and provider
configuration are preservation material, not default development inputs.

Changes to Hotel and Retail share authentication, tenancy, commerce and media
contracts. Preserve Restaurant/Cafe behavior and tenant isolation. Keep local
test evidence, public runtime evidence and real payment/booking acceptance
separate. The dedicated Damoon frontend is in `sites/damoon`.

## Continuous handoff — owner rule (2026-11-26)

Speed is the primary delivery priority. Deliver cohesive functional batches, use existing CI and focused regression checks, and do not reopen completed acceptance without a new reason. Update the applicable existing roadmap and current-status documentation in the same functional PR; include delivered scope, remaining scope, next action and known blockers. Keep Git/CI/merge/live evidence distinct; use the PR and Git history as authoritative for the exact merge SHA. After merge record real deployment or live evidence in the existing status/handoff when available (never invent it); avoid a separate documentation-only PR solely for routine bookkeeping. For Hotel/Damoon begin with docs/hotel/damoon/README.md, ROADMAP.md and STATUS-AND-DECISIONS.md and the active platform handoff. Do not relax tenant isolation, production-data authorization, or real-payment gates.

### PR173 merged (2026-11-26)

- Branch: `codex/hotel-pms-professional-1a`, head `d88cbcc70e8f91dffdedcfee882f02f6b9e796cf`, merge `c9d6ea2ca98bc4d2b47e74cb2fe4a75e05d5d241`
- Base: `935b26b1e48ca3f31b49fc42409d693979d04cb4` (origin/main)
- CI gates: RunFlare TypeScript pass, focused-regressions pass, hotel-phase1-operational-pg pass, request-to-reception pass; Vercel blocked (known suspended-preview exception)
- Scope: PMS Professional 1A — shared Gregorian ISO property-local date helper, reception date validation and localized feedback, 1/7/31-day calendar controls with scoped refresh, allowlisted FA/EN/AR domain errors, manual reservation simulated payment fix, extended E2E calendar refresh and 1/31-day range coverage, 5 focused unit tests
- Next phase: P1B — transactional date amendments (extend/shorten), in-house room move, reception lifecycle completion; no schema change, no real payment activation

### PR174 merged (2026-11-26)

- Branch: `codex/hotel-pms-professional-1b`, head `b689070e5f686fe9f6c3a1bf330d3c64842a61da`, merge `3ec5967e102e840bfb84eb1afeb5d1d57b6fe63a`
- Base: `0e34f38b5a658920fe64e1f882999130cd00a697` (origin/main, PR173 merge)
- CI gates: RunFlare TypeScript pass, focused-regressions pass, hotel-phase1-operational-pg pass, request-to-reception pass; Vercel blocked (known suspended-preview exception)
- Scope: PMS Professional 1B — preview/confirm date changes, extensions and shortening for unpaid manual reception reservations; same-category in-house room move for checked-in guests; FA/EN/AR reception-center controls; property-scoped refresh and feedback; 7 focused unit tests; extended manual reception acceptance (preview, extension, stale/idempotent apply, move, shortening)
- Next phase: P1C — remaining reception/1C scope; mandatory stop before Housekeeping until owner explicitly authorizes resumption

### PMS Professional 1C-A — pending CI
- Staff reception: loaded-reservation search by guest/companion/reference/room with Persian/Arabic normalization; read-only guest list and bounded sanitized action history; unpaid manual no-show after property-local arrival day using atomic inventory release and idempotency.
- No schema change or real payment execution. CI/merge/live evidence is not yet recorded. Remaining PMS Professional: arrival/departure edge cases, full Jalali date picker, grouped reservations, durable guest files, waitlist and complete audit/search. Owner stop before Housekeeping still applies.

### PR175 merged (2026-11-26)

- Merge `54dcbfc82de5f6548dfb6bb0572015474c864e06`, head `07240f43ca5d5f79bbe30bb8793b899a64db52b9`; four hosted execution gates passed, Vercel Preview remains blocked.
- 1C-A: loaded-reservation search, reservation guest projection, bounded reception history and unpaid manual no-show. 1C-B proposed: shared Jalali single-date selection in reception intake, amendments and occupancy navigation; retain ISO contracts and native date input. No production deployment claim. Remaining reception and 1C work precedes the mandatory owner gate.

## PMS Professional 1C-C — reception lifecycle (proposed; CI pending)
- Base main `5e1819c9746e125aeab28b22fb35aade5b19e1ca`: PR176 merged, three PR-head gates successful and manually dispatched request-to-reception on merged main successful ([run 45729895850](https://github.com/QComputer/shadcn-rtl/actions/runs/45729895850)). Vercel Preview suspended; live Runflare not verified.
- 1C-C: property-local arrival window and early-arrival acknowledgement; late arrival inside the booked dates; block arrival/move to a room still occupied by a checked-in guest (including overdue). Actual timestamps, localized FA/EN/AR controls and existing idempotency audit. Early checkout of unpaid manual stays may shorten via versioned amount preview and atomic checkout, retaining today's night. Explicit retain-all departure records physical checkout without financial or inventory changes; finance reconciliation remains deferred. No same-day inventory release or automatic late charges. CI trigger includes all hotel-operations components.
- Remaining: global search, durable guest dossier, grouped reservations, waitlist, PMS acceptance, then mandatory owner diversion gate before any Housekeeping. No migration, production mutation, real payment or SMS.

## Hotel mandatory phase boundary

OWNER GATE (2026-11-26): After completion of PMS Professional (1A/1B/1C and remaining reception items), STOP immediately before any Housekeeping implementation. The owner will specify an intervening phase. Do not start Housekeeping until that phase is completed and the owner explicitly authorizes resumption.
