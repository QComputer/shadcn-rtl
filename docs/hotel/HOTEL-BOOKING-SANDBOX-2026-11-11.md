# Hotel booking sandbox — 2026-11-11

Development package stacked on PR51. No migration or Production activation.

## Delivered

- Existing room/rate/inventory management connects to availability, server-priced quotes, holds and atomic reservations.
- Quote freezes nightly amounts, TOMAN currency and cancellation policy version/snapshot. Invalid configuration fails closed.
- Scoped durable action keys and transaction locks prevent duplicate reservations, payments and inventory release. Guest identity comes from the authenticated tenant context.
- Local payment adapter supports SUCCESS, FAILED and EXPIRED with immutable replay. It creates no provider payment or financial transaction.
- Reception lists sandbox reservations and supports cancellation/check-in/check-out; guest access is ownership-scoped.
- Follow-up reception package adds staff-only physical room assignment for every occupied night. Room-row locks and the existing unique room/date constraint prevent competing allocations; check-in requires a complete valid assignment. Cancellation clears physical claims while retaining nightly prices.
- Guest portal: `/{locale}/hotel-sandbox/{organizationId}/{propertyId}` on a verified Hotel domain. UI supports fa/en/ar; browser acceptance below is English desktop.

## Local acceptance

Real disposable PostgreSQL 17, loopback port 55439, database `retail_hero_test`, role `hero_test`; no inherited environment files. Acceptance flags and exact database guards are mandatory. Schema was pushed into this disposable database, not rehearsed as a Production migration.

- `tests/integration/hotel-booking-sandbox.local.test.ts`: rates/policy snapshots, guest binding, concurrent retries, expired holds, payment/cancel races, reception transitions, cross-tenant and same-tenant ownership denials.
- `tests/integration/hotel-reservation-atomic.local.test.ts`: existing hold consumption regression.
- `tests/unit/hotel-booking-sandbox-gate.test.ts`: Production/non-fixture denial, simulated outcomes and input tampering.
- `tests/integration/hotel-booking-sandbox-http.local.test.ts`: installed Chrome, actual login/API/UI, two verified synthetic domains and one shared customer. Room/rate/inventory created through management forms; cancellation policy is a fixture. Successful payment and reception cancellation use the UI; failed/expired payment and callback replay use HTTP plus DB assertions.
- Durable browser receipt: `.tmp/hotel-booking-sandbox-p0/hotel-booking-sandbox-http.result.json`: PASSED, exitCode 0, cleanup PASSED. Webpack is selected explicitly for this local harness; earlier Turbopack runs had inconsistent API/RSC session decryption. The final Webpack run passes without changing authentication.
- Follow-up acceptance: all 4 PostgreSQL/regression/gate tests passed, including concurrent room claims, foreign/inactive/out-of-service denial, adjacent stays and cancellation/reuse. Chrome also passed assignment, cancellation, room reuse and reception check-in/check-out (same durable receipt, complete/exitCode 0/cleanup PASSED). Both main CI checks passed for the first package at `0e78f445`; follow-up CI is tracked separately.

The sandbox requires `HOTEL_BOOKING_SANDBOX_ENABLED=1`, non-production execution and the exact local fixture database tuple. Hotel anonymous operational hold/cron, real payment and messaging remain disabled. No live provider acceptance is implied.

## Remaining boundary

Provider callbacks/financial reconciliation and operational publication remain later slices. Request-driven expiry cleanup handles sandbox holds; no scheduler was activated.

PR48 source compatibility rehearsal against the existing PR51 head found one CI workflow append conflict, with no other source conflict. Preserve both test groups during final integration; combined runtime acceptance remains pending. PR48 itself is unchanged.
