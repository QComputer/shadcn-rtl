# Hotel reservation persistence — atomic hold consumption

Development slice stacked on operations PR50. No new HTTP route, schema migration, payment-provider implementation or Production gate change.

`PrismaHotelRepositories.createReservation` now locks the scoped hold and tenant retry key, validates the held stay/resource/rate-plan/currency, and writes the reservation/night/guest snapshots together with ACTIVE→CONSUMED and held→booked inventory movements in one transaction. Single-room holds only, matching the existing reservation-night ledger. Existing trusted no-hold creation remains supported.

Same-key replay compares hold, property, room type, rate plan, dates, night rates, guests, money/currency and policy snapshot; it returns the existing durable result without another movement, or raises the existing idempotency conflict. Invalid/expired/foreign/underheld holds fail closed. Returned reservations include saved night/guest snapshots.

Real isolated PostgreSQL acceptance passed: two-night consumption, concurrent same-key requests, changed replay payloads, foreign resources, expiry, insufficient inventory, second key on consumed hold, and rollback of parent/hold/inventory on a real child unique-constraint failure. Legacy no-hold creation and conflicting replay also passed; fixture cleanup asserted zero owned organizations/reservations. Logs: `.tmp/hotel-reservation-atomic/postgres-final.log`.

This fixes the persistence seam; it does not certify the public reservation/payment flow. `confirmBookingHold` still needs sequential replay handling and a server-resolved quote/policy API adapter. Payment repository stubs and atomic cancellation/release remain separate unfinished work. No server route accepts a client-supplied payment-verification claim.

Quality gates: full repository TypeScript check exited 0; scoped lint has 0 errors (the repository file retains 24 pre-existing any/unused-stub warnings). PostgreSQL rerun after final validation cleanup passed. No browser acceptance is claimed for this persistence-only slice.
