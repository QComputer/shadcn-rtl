# HOTEL → Kilo handoff — 2026-11-11

## A. Baseline and authority

Workspace: `C:/Users/disso/Project/shadcn-rtl`; one worktree. Branch `codex/hotel-operational-reservation-20261111`. Accepted application HEAD/remote: `1518a3a93b179ffd3e3484a975faef7cd72f88ff` (PR58, OPEN Draft). This handoff-only commit will follow that SHA; it does not extend application acceptance. Remote main: `4cc3313e25988ff3f0ed255b2821436799e27033`.

Read AGENTS.md and ai-handoff.md for conventions, but the owner's latest functional-first scope supersedes old phase-one exclusions. Documentation/knowledge integration is CLOSED; do not repeat the questionnaire audit. Use installed Next guides under `node_modules/next/dist/docs/` before changing Next code. Use locked dependencies. Do not assume access to prior ChatGPT chats.

## B–C. Actual path and code map

`Guest → Quote → Hold → Reservation(PENDING_PAYMENT) → [PaymentRequest → Provider → Verification: WIP, not wired] → Settlement → Confirmation → Reception → Checkout`

| Stage | Source / boundary |
|---|---|
| Domain, session and identity | `proxy.ts`; `lib/api-guards.ts` (`requireAuthSession(request)`); `lib/hotel/services/booking-context.ts`; existing `lib/customer-auth/`, `lib/auth.ts` |
| Dedicated Damoon entry | `sites/damoon/booking-flow.js`; `app/api/hotel/v1/guest-portal/route.ts`; generated counterpart `public/damoon-front/booking-flow.js` and manifest |
| Guest page / UI | `app/[locale]/hotel-reservations/[organizationId]/[propertyId]/page.tsx`; `components/hotel-operations/hotel-operational-reservations.tsx` |
| Operational API | `app/api/organizations/[id]/hotels/[propertyId]/reservations/route.ts` (GET, POST, admin PATCH) |
| Quote / inventory / reservation | `lib/hotel/services/hotel-operational-reservation.service.ts`; shared `booking-quote.ts`; `lib/hotel/persistence/prisma-hotel-repositories.ts` (`claimInventoryAndCreateHold`, `createReservation`, `releaseHold`) |
| Request-only / conversion | `hotel-stay-request.service.ts`, `hotel-stay-requests.tsx`; `quote-request` action always requotes current terms, never automatically confirms |
| Financial boundary | Accepted repository `applyVerifiedPayment` (PR56); application `lib/hotel/services/hotel-booking.service.ts` (`reconcileVerifiedPayment`) |
| Cancellation | Accepted repository `cancelReservationAndReleaseInventory` (PR57), used by operational service; no fabricated refund |
| Reception | `hotel-operational-reception.tsx`, `hotel-operations-workspace.tsx`, dashboard hotel-operations page; operational service actions `assign-room`, `check-in`, `check-out`, `cancel` |
| Payment primitives / future provider reuse | `lib/payments/payment-request.service.ts`, `lib/payments/inoti-payment-lifecycle.service.ts`; WIP files below, no operational payment route/UI yet |

Quotes and reservations recheck current price, currency, policy/version, resources and occupancy. Hold → reservation consumes inventory atomically. Request-driven expiry releases active holds and pending reservation inventory without enabling Cron. Guest history derives from owned operational quotes, with separate organization/actor-scoped action ledgers. Reception has basic list/actions and financial counters; advanced filtering/history presentation and full financial lifecycle are not accepted as complete.

## D. Prisma contracts (`prisma/schema.prisma`)

- `OrganizationDomain`, `OrganizationCapability`, `OrganizationMember`, `CustomerClubMembership`, `CustomerIdentity`, `GuestCustomer`: verified host/session, organization capability and membership; a shared user ID does NOT authorize another tenant's session.
- `HotelProperty` owns room types, rooms, rate plans, policies and inventory through organization/property composite relations. `operationalMode` defaults DISABLED; enum includes REQUEST_ONLY and RESERVATION.
- `HotelStayQuote`: org/property/user, expiry, frozen JSON snapshot; operational snapshot gains holdId/reservationId. `HotelStayRequest` has unique quoteId and guest-owned enquiry state.
- `HotelInventory`: per room type/date counters. `HotelBookingHold`: expiry, status, quantity and frozen financial terms; reservation holdId is unique.
- `HotelReservation`: org/property/type/rate, immutable nightly/policy terms, guestCustomerId, lifecycle timestamps/version, paidAmount/refundedAmount. `HotelReservationRoom` retains price history; `(roomId,date)` unique blocks overlapping physical claims. Cancellation clears roomId and releases counters, preserving nightly prices.
- `PaymentRequest`: org/guest/customerIdentity/integration/merchant snapshots, integer TOMAN amount, purpose and state. `PaymentProviderAttempt` stores verification/binding/evidence. `HotelPaymentAllocation`: unique paymentRequestPublicId and `(hotelReservationId,kind)`; presently full balance/single refund allocation, not a general partial-refund engine.
- There is NO standalone RefundRequest model. WIP uses PaymentRequest purpose RESERVATION_REFUND plus metadata requestType HOTEL_REFUND; final contract still needs acceptance.
- `HotelInventoryIdempotency`: fixed operational quote/action scopes; system expiry uses `HOTEL_OPERATIONAL_SYSTEM_EXPIRY` separately so caller keys cannot block expiry.

## E. Gates / non-negotiable limits

- Operational service requires BOTH `HOTEL_GUEST_PORTAL_ENABLED=1` and `HOTEL_OPERATIONAL_RESERVATIONS_ENABLED=1`, plus active HOTEL capability/property and persisted mode RESERVATION. Defaults remain off. REQUEST_ONLY stays independently usable.
- Customer APIs require verified request-derived Customer Context, session organization, active membership and resource ownership. Never trust a body organizationId. Admin configuration requires persisted ADMIN membership (or SUPER_ADMIN).
- Sandbox keeps its own flag, NODE_ENV production ban, exact loopback database tuple and actual database/user checks. Do not relax these to deploy operational code.
- WIP simulator additionally requires `HOTEL_OPERATIONAL_PAYMENT_SIMULATOR_ENABLED=1`, strict existing sandbox gate, actual disposable DB identity and synthetic org slug prefix `hotel-operational-`. Intent simulation also requires fixtureOnly integration configuration. No real provider adapter is installed by default.
- Keep `HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED=0` and `HOTEL_CRON_SCHEDULER_ENABLED=0`. No real gateway, SMS, reservation activation, Production migrations/data changes, Runflare operations or main merge/push without owner authorization. Runflare is the target; Vercel is not an acceptance gate.

## F. Verified evidence (do not rerun without related change)

At application SHA `1518a3a9`, both exact-SHA CI runs succeeded:
- TypeScript: https://github.com/QComputer/shadcn-rtl/actions/runs/43071780356
- Focused regressions + isolated PostgreSQL: https://github.com/QComputer/shadcn-rtl/actions/runs/43071787538

Local `.tmp/hotel-e2e-next/reservations-final-pg.log`: PASSED, zero skipped, cleanup PASSED. Covers two tenants/shared user, capacity contention, stale price/policy, replay, gates off, expired active/consumed holds, request conversion, physical overlap and reception lifecycle; also adversarial client/system expiry-key collision.

`.tmp/hotel-operational-reservations/http.result.json`: PASSED, exitCode 0, cleanup PASSED, Chrome/server stopped. Log: `.tmp/hotel-e2e-next/operational-reservation-http-final.log`. Verified tenant-host guest quote/hold/reserve, own history/foreign-session denial and reception assignment/check-in/check-out. Reception confirmation was explicitly seeded synthetic state; paidAmount stayed zero. This is NOT provider/payment/financial acceptance. fa/ar UI exists; this browser receipt covers English desktop, not comprehensive language/mobile acceptance.

Accepted PR56/57 tests: `hotel-verified-payment.local.test.ts`, `hotel-atomic-cancellation.local.test.ts` under tests/integration. Full local typecheck of reservation package excluded the two WIP payment files; exact-SHA CI checked the complete committed tree. `.tmp/hotel-e2e-next/reservation-release-typecheck.log` and `reservation-release-lint.log` are empty successful logs; their exit codes were captured during execution. Payment WIP has no final TypeScript/PG/Chrome acceptance.

## G–H. Preserved payment WIP — do NOT publish as complete

1. `lib/hotel/services/hotel-operational-payment.service.ts` (untracked)
   - Class constructor `(db, now, adapter)`, `get`, `execute`; strict command schema: create-payment, reconcile-payment, request-refund, simulate-payment, simulate-refund. Private createPayment/reconcile/createRefund/simulate; adapter available/start/verify/refund; default unavailable.
   - Reuses PR58 actor/ownership/mode gates, payment primitives, PR56 settlement and cancellation-policy calculation. Contains pending intent reuse, PROCESSING/COMPLETED action ledger, provider calls, refund requests and fixture-only simulation. Valuable continuation, NOT accepted functionality; no route/UI imports it.
   - SHA256: `F98ACFFF66510E81277419E4FD2C57D9C275E0F6F4F1AFB23D547CD16920C044`.
2. `tests/integration/hotel-operational-payment.local.test.ts` (untracked)
   - Gate-off test plus unfinished PostgreSQL intent/idempotency fixture; gated by HOTEL_OPERATIONAL_PAYMENT_ACCEPTANCE. No final successful full-file receipt. It does NOT yet prove refunds, callback/cancellation races, two actual tenants or complete payment E2E.
   - SHA256: `057DC5697CCE5F9531284348F8730773AF5B3F90781CC6C1E8574E86B937D858`.

Private backup of these two files: `C:/Users/disso/.codex/recovery/hotel-operational-payment-wip-20261111212013.zip`. Original files remain in place. Backup is historical: compare hashes before restoring, never overwrite newer edits blindly. Both files are directly continuable by Kilo after the following fixes/tests; do not rebuild the accepted reservation engine.

## Critical review / exact remaining TODOs

| Question | Accepted code / WIP risk |
|---|---|
| Confirmation without verified payment? | Published operational API has no confirm/pay-success command; it creates PENDING_PAYMENT. PR56 requires stored PAID request + matching VERIFIED non-simulated evidence before confirming. Generic internal status-update helpers and explicit fixtures are not payment-verification APIs. WIP `reconcile` writes PAID before repository acceptance; reject simulated/untrusted evidence BEFORE financial writes and reconcile partial failures safely. WIP refund VERIFIED branch also needs explicit simulated-evidence rejection. Default adapter is unavailable and WIP is not routed. |
| Duplicate callback / allocation? | PR56 locks reservation/payment and uses unique allocation + replay checks; tested. WIP action ledger commits PROCESSING before work, completes separately, deletes PROCESSING on errors: crash/unknown-provider recovery is incomplete. Concurrent same-key call may return 409 PROCESSING, while its test expects identical successful responses. Different-key create now returns prior intent, while test expects rejection. Resolve contracts/tests explicitly; do not blindly retry an uncertain external effect. |
| Cross-tenant payment? | PR56 binds org/property/reservation/guest/amount/currency/merchant/integration and verified attempt. WIP has scoped lookups, but refund must also prove original BALANCE allocation/guest/property/amount and provider binding, not only matching reservation metadata. Add real A/B tenant tests. |
| Cancel vs payment? | Accepted settlement/cancellation share reservation row lock; tested. WIP provider verification/status writes occur outside settlement transaction; PAID-but-cancelled needs explicit reconciliation/refund handling, not silent reconfirmation. |
| Manipulated amount/currency? | WIP strict schema accepts no client amount/currency, derives full TOMAN amount from locked reservation; PR56 rechecks exact balance. Still validate all binding/currency/deadline facts under mutation locks and test malformed persisted subjects. |
| Simulator in Production? | Existing production/exact-DB gates prevent activation by source review; default provider unavailable. No new Production test executed here. Keep simulated results tagged and rejected by real settlement; never expose adapter injection/client VERIFIED outcomes. |

Additional WIP blockers: no operational payment API/UI; active/uncertain intent restart and provider binding readiness are incomplete. Simulator does not fully enforce hold/payment deadlines/currency like PR56. Default unavailable-adapter refund creates CREATED, but simulate-refund currently requires PENDING_VERIFICATION: fixture refund flow is not connected. Policy math exists but original-allocation verification, refund replay/async recovery and live provider acceptance are incomplete. Schema command makes integrationId optional while a separately maintained ActionInput asserts required via cast; derive the type from Zod. No claim of final semantic TypeScript success for these files.

Test repairs BEFORE payment PG execution: concurrent PROCESSING/replay and prior-intent expectations mismatch source; test says tenant-bound but creates one organization; broad guest cleanup uses startsWith and must become exact owned IDs; fix cleanup order/identity ownership. Fixture creates reservation without consumed hold/inventory, so cannot validate true settlement. Extend accepted reservation fixture rather than bypassing lifecycle constraints.

## I–J. Efficient continuation and targeted commands

First command (PowerShell, repository root):
```powershell
git status --short
Get-Content docs/hotel/HOTEL-KILO-HANDOFF-2026-11-11.md
```

Use Node 24 and locked dependencies. Existing private local runners are available in this SAME workspace, not tracked/portable build tooling. They whitelist env and guard the disposable DB; inspect them without printing secrets. Do not source archived .env/dumps/provider configuration. Disposable PostgreSQL 17 container was stopped/removed after acceptance; recreate only a fresh owned loopback fixture (127.0.0.1:55439, retail_hero_test, hero_test) from existing fixture-only runner/CI service configuration. No real connection string or credentials belong in this handoff. Initialize only that DB using `.tmp/hotel-reservation-atomic/setup.cjs` and explicit `.tmp/customer-identity-p0/prisma.config.ts`; generate client only if necessary. For auth HTTP tests apply existing revocation triggers via `.tmp/hotel-e2e-next/install-reservation-auth-triggers.cjs` after updating its owned container name.

Suggested first test AFTER repairing the payment fixture (not executed in this handoff):
```powershell
# In a newly whitelisted isolated runner, add HOTEL_OPERATIONAL_PAYMENT_ACCEPTANCE=1
# to its child env; setting only the parent env is discarded by the whitelist.
node .tmp/hotel-e2e-next/run-payments.cjs .tmp/hotel-e2e-next/payment-pg.log tests/integration/hotel-operational-payment.local.test.ts
```
`run-payments.cjs` does not exist yet: derive it from existing `run-reservations.cjs`, keeping all guards/no-send flags and changing only the payment acceptance flag. Simulator tests additionally need its own flag plus strict sandbox gate. Do not count skipped tests as acceptance.

Reservation regression only when related code changes:
```powershell
node .tmp/hotel-e2e-next/run-reservations.cjs .tmp/hotel-e2e-next/reservation-check.log tests/integration/hotel-operational-reservations.local.test.ts
node .tmp/hotel-e2e-next/run-reservation-http.cjs .tmp/hotel-e2e-next/reservation-browser.log tests/integration/hotel-operational-reservations-http.local.test.ts
pnpm exec tsc --noEmit --incremental false
```
Run heavy typecheck and Next/Chrome serially. HTTP harness uses next dev --webpack, port 3037, a fixed fixture-only auth secret, tenant Host/Origin, and Chrome. Do not emit a live server log into the watched source tree; it buffers logs. Require final receipt PASSED/exitCode=0/cleanup=PASSED. Distinguish application, harness and environment defects. Do not broadly rebuild/sync Damoon public files: source/public include intentionally scoped differences; update only intended modules and manifest hashes from committed LF bytes.

Kilo order: (1) preserve/check current state; (2) create a short-lived codex/ payment branch from accepted PR58 line, same worktree; (3) repair WIP contracts and exact-scoped fixture; (4) isolated two-tenant intent/callback/failure/expiry/refund/cancel-race tests; (5) safe API/UI integration; (6) Chrome full financial fixture flow with explicit simulation labels; (7) scoped lint + full committed-source TypeScript, independent commit/PR stacked on PR58. Default free Kilo routing when available; retain critical financial review. No need to rerun all accepted frontend/recovery work.

## K–L. Protected state and branch dependencies

All PR48–58 currently OPEN Draft. Preserve their history/bases:

| PR | Head branch | Accepted tip | Base |
|---|---|---|---|
| 48 | codex/damoon-phase1-20261110 | 976aa6ab | main |
| 49 | codex/customer-identity-p0-20261111 | d3d392dd | main |
| 50 | codex/damoon-operations-20261111 | 1fffbdbc | PR49 |
| 51 | codex/hotel-reservation-atomic-20261111 | 693917f5 | PR50 |
| 52 | codex/hotel-booking-sandbox-20261111 | 0e78f445 | PR51 |
| 53 | codex/hotel-reception-room-assignment-20261111 | 23cd35f5 | PR52 |
| 54 | codex/hotel-operational-integration-20261111 | 019b04fc | PR53; two-parent merge also includes PR48 |
| 55 | codex/hotel-guest-requests-20261111 | b2dae973 | PR54 |
| 56 | codex/hotel-verified-settlement-20261111 | 968c808e | PR55 |
| 57 | codex/hotel-atomic-cancellation-20261111 | ecabc812 | PR56 |
| 58 | codex/hotel-operational-reservation-20261111 | 1518a3a9 application baseline | PR57; handoff-only commit follows |

Inherited tracked dirty files (9): AGENTS.md; docs/AI_HANDOFF_CURRENT_STATE.md; docs/AI_HANDOFF_NEXT_PROMPT.md; docs/AI_HANDOFF_PROJECT_CONTEXT.md; docs/AI_HANDOFF_VALIDATION.md; docs/CURRENT_SOURCE_OF_TRUTH.md; docs/NEXT_PHASE_ROADMAP.md; docs/PROJECT_PROSPECT_AND_CURRENT_STATUS.md; docs/completion/MASTER_PROJECT_COMPLETION_ROADMAP.md. They were NOT included in PR58 and must not be overwritten/staged incidentally.

Inherited untracked files (3): docs/DAMOON-CHAT-KNOWLEDGE-HANDOFF-v1.1-FA.md; test-runner.sh; typecheck.log. Two additional untracked WIP files are listed above. Stage explicit related paths only; no add -A/reset/clean/blind stash or extra worktree. Preserve Retail and other agents' work; unexpected new changes require comparison, not deletion.

Retail archive: `C:/Users/disso/.codex/recovery/bazarbaaz-retail-20261110/ignored-recovery.zip`, SHA256 `8ABA7A714E8533A95C5CDB5BE6898A7A9ADC006BDFF056D35040754AE88DDD1C`. Leave all private recovery material intact. Do not activate Production or merge main based on CI alone. This is a handoff, not new release approval.
